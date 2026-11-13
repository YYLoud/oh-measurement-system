/**
 * 姿勢性低血壓 (OH) 測量指導與臨床記錄系統 - 主控制器 (app.js)
 * 支援：台灣國語 (zh-TW) 與 台灣台語 (預合成 MP3 音檔) 雙語自由搭配播報
 */

class OHAppController {
  constructor() {
    this.audioEngine = new window.OHAudioEngine();

    // 流程設定與狀態
    this.includeSittingStep = false;
    this.quickDemoMode = false; // 快速測試模式 (將等待時間縮短為 15 秒方便預覽與教學)
    this.customDurations = {
      supine_rest: 300,
      sitting_transition: 60,
      stand_1min: 60,
      stand_3min: 120
    };

    this.currentStepIndex = 0;
    this.completedStepIds = new Set();
    this.selectedHistoryIds = new Set();

    // 計時器狀態
    this.timerInterval = null;
    this.timerRunning = false;
    this.timerTotalSec = 0;
    this.timerRemainingSec = 0;
    this.preAlertTriggered = false;

    // 當前病患測量資料模型
    this.currentRecord = this._createFreshRecord();

    this._init();
  }

  _createFreshRecord() {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now - tzOffset).toISOString().slice(0, 16);

    return {
      id: null,
      measuredAt: localISOTime.replace('T', ' '),
      measuredAtInput: localISOTime,
      abortedEarly: false,
      abortReason: '',
      patient: {
        chartId: '',
        name: '',
        age: '',
        gender: '',
        arm: '左手 (Left Arm)',
        cuffSize: '標準成人壓脈帶 (Standard)',
        notes: ''
      },
      measurements: {
        supine: { sbp: '', dbp: '', hr: '', symptoms: ['none'] },
        sitting: { sbp: '', dbp: '', hr: '', symptoms: ['none'] },
        stand1: { sbp: '', dbp: '', hr: '', symptoms: ['none'] },
        stand3: { sbp: '', dbp: '', hr: '', symptoms: ['none'] }
      }
    };
  }

  getActiveSteps() {
    return (window.OH_PROTOCOL_STEPS || []).filter(step => {
      if (step.optionalSitting && !this.includeSittingStep) {
        return false;
      }
      return true;
    });
  }

  getCurrentStep() {
    const steps = this.getActiveSteps();
    if (this.currentStepIndex >= steps.length) {
      this.currentStepIndex = steps.length - 1;
    }
    return steps[this.currentStepIndex] || steps[0];
  }

  getStepDurationSec(step) {
    if (!step || !step.hasTimer) return 0;
    if (this.quickDemoMode) {
      return 15;
    }
    return this.customDurations[step.id] || step.defaultDurationSec || 60;
  }

  _init() {
    this._bindAudioCallbacks();
    this._bindNavigationTabs();
    this._bindGuidanceControls();
    this._bindRecordFormInputs();
    this._bindSettingsControls();
    this._bindHistoryControls();

    // 載入使用者儲存於本機之個人化設定 (localStorage)
    this._loadUserSettings();

    this._syncPatientFormFromModel();
    this._renderStepper();
    this._loadStep(0, { autoSpeak: false });
    this._renderMeasurementStages();
    this._updateClinicalAssessment();
    this._refreshHistoryTable();

    // 依指示：「病患動作指引與醫護台詞對話卡」預設全面摺疊收合，讓版面保持簡潔
    const dualRoleDrawer = document.getElementById('dualRoleDrawer');
    if (dualRoleDrawer) {
      dualRoleDrawer.open = false;
    }
  }

  /**
   * 綁定語音與輕音樂狀態指示器
   */
  _bindAudioCallbacks() {
    const voiceDot = document.getElementById('voicePulseDot');
    const voiceStatusText = document.getElementById('voiceStatusText');
    const musicToggleBtn = document.getElementById('headerMusicToggleBtn');
    const timerRingContainer = document.getElementById('timerRingContainer');

    this.audioEngine.onSpeakingStatusChange = (speaking) => {
      if (voiceDot) voiceDot.classList.toggle('active', speaking);
      if (voiceStatusText) {
        voiceStatusText.textContent = speaking ? '語音播報中...' : '國台語待命';
      }
    };

    // 專屬語音播放進度回呼（專供無倒數計時階段使用）
    this.audioEngine.onVoiceProgress = (progress) => {
      this._handleVoiceProgress(progress);
    };

    this.audioEngine.onMusicStatusChange = (playing) => {
      if (musicToggleBtn) {
        musicToggleBtn.classList.toggle('playing', playing);
        musicToggleBtn.innerHTML = playing ? '🎵 輕音樂播放中 (點擊暫停)' : '🎵 播放舒緩輕音樂';
      }
      if (timerRingContainer) {
        timerRingContainer.classList.toggle('music-breathing', playing);
      }
    };

    this.audioEngine.onVoicesLoaded = (twVoices, selectedURI) => {
      const voiceSelect = document.getElementById('twVoiceSelect');
      if (!voiceSelect) return;

      voiceSelect.innerHTML = '';
      if (twVoices.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '系統預設台灣繁體中文語音 (zh-TW)';
        voiceSelect.appendChild(opt);
      } else {
        twVoices.forEach(v => {
          const opt = document.createElement('option');
          opt.value = v.voiceURI;
          opt.textContent = `${v.name} (${v.lang})`;
          if (v.voiceURI === selectedURI) opt.selected = true;
          voiceSelect.appendChild(opt);
        });
      }
    };
  }

  /**
   * 頂部摺疊側邊欄與頁籤導覽切換
   */
  _bindNavigationTabs() {
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const closeBtn = document.getElementById('sidebarCloseBtn');
    const currentNavLabel = document.getElementById('currentNavLabel');

    const openSidebar = () => {
      if (sidebar) sidebar.classList.add('open');
      if (backdrop) backdrop.classList.add('open');
    };

    const closeSidebar = () => {
      if (sidebar) sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('open');
    };
    this.closeSidebar = closeSidebar;

    if (toggleBtn) toggleBtn.addEventListener('click', openSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (backdrop) backdrop.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSidebar();
    });

    const tabLabelMap = {
      'tab-workspace': '📋 測量指導與即時記錄',
      'tab-history': '🗂️ 歷史紀錄管理',
      'tab-settings': '⚙️ 語音、輕音樂與時間設定'
    };

    const allTabBtns = document.querySelectorAll('.sidebar-tab-btn, .nav-tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    allTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        if (!targetId) return;

        allTabBtns.forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-tab') === targetId);
        });
        tabPanels.forEach(p => p.classList.toggle('active', p.id === targetId));

        if (currentNavLabel && tabLabelMap[targetId]) {
          currentNavLabel.textContent = tabLabelMap[targetId];
        }

        if (targetId === 'tab-history') {
          this._refreshHistoryTable();
        }

        closeSidebar();
      });
    });

    // 同步頂部與設定頁的語音語言模式選擇器
    const headerLangModeSelect = document.getElementById('headerLangModeSelect');
    const settingsLangModeSelect = document.getElementById('settingsLangModeSelect');

    const syncLanguageMode = (newMode) => {
      this.audioEngine.languageMode = newMode;
      if (headerLangModeSelect && headerLangModeSelect.value !== newMode) {
        headerLangModeSelect.value = newMode;
      }
      if (settingsLangModeSelect && settingsLangModeSelect.value !== newMode) {
        settingsLangModeSelect.value = newMode;
      }
      const modeNameMap = {
        patient_tw_staff_zh: '對病患講台語、對醫護人員講國語',
        all_tw: '全台語播報模式',
        patient_both_staff_zh: '對病患講國語＋台語、對醫護講國語',
        all_zh: '全台灣國語播報模式'
      };
      this.showToast(`🗣️ 已切換為「${modeNameMap[newMode] || newMode}」`);
    };

    if (headerLangModeSelect) {
      headerLangModeSelect.addEventListener('change', (e) => syncLanguageMode(e.target.value));
    }
    if (settingsLangModeSelect) {
      settingsLangModeSelect.addEventListener('change', (e) => syncLanguageMode(e.target.value));
    }

    // 頂部快速輕音樂開關與語音測試按鈕
    const musicToggleBtn = document.getElementById('headerMusicToggleBtn');
    if (musicToggleBtn) {
      musicToggleBtn.addEventListener('click', () => {
        this.audioEngine.toggleRelaxingMusic();
      });
    }

    const testVoiceBtn = document.getElementById('headerTestVoiceBtn');
    if (testVoiceBtn) {
      testVoiceBtn.addEventListener('click', () => {
        this.audioEngine.speakPrompt({
          patientText: '您好，這是台灣國語語音測試，等一下測量血壓時請放輕鬆。',
          patientTwAudioUrl: 'audio/taiwanese/test_voice.mp3',
          patientZhAudioUrl: 'audio/mandarin/test_voice_patient.mp3',
          staffText: '醫護人員您好，台語與國語雙語提示及輕音樂音量自動調節功能運作正常。',
          staffTwAudioUrl: 'audio/taiwanese/prep_staff.mp3',
          staffZhAudioUrl: 'audio/mandarin/test_voice_staff.mp3',
          chimeType: 'normal'
        });
      });
    }
  }

  /**
   * 第一部分：互動式測量指導與計時控制
   */
  _bindGuidanceControls() {
    const includeSittingToggle = document.getElementById('includeSittingToggle');
    if (includeSittingToggle) {
      includeSittingToggle.addEventListener('change', (e) => {
        this.includeSittingStep = e.target.checked;
        this.currentStepIndex = 0;
        this._renderStepper();
        this._loadStep(0, { autoSpeak: false });
        this._renderMeasurementStages();
        this._updateClinicalAssessment();
      });
    }

    const quickDemoToggle = document.getElementById('quickDemoToggle');
    if (quickDemoToggle) {
      quickDemoToggle.addEventListener('change', (e) => {
        this.quickDemoMode = e.target.checked;
        this._stopTimer();
        const step = this.getCurrentStep();
        this.timerTotalSec = this.getStepDurationSec(step);
        this.timerRemainingSec = this.timerTotalSec;
        this._updateTimerUI();
        this.showToast(
          this.quickDemoMode
            ? '⚡ 已開啟「15秒快速測試模式」，方便快速體驗語音與計時流程'
            : '⏱️ 已恢復標準臨床測量時間（平躺 5 分鐘 / 站立 1、3 分鐘）'
        );
      });
    }

    const primaryStepActionBtn = document.getElementById('primaryStepActionBtn');
    if (primaryStepActionBtn) {
      primaryStepActionBtn.addEventListener('click', () => {
        this.startCurrentStepAction();
      });
    }

    const replayVoiceBtn = document.getElementById('replayVoiceBtn');
    if (replayVoiceBtn) {
      replayVoiceBtn.addEventListener('click', () => {
        this._speakStepVoice(this.getCurrentStep());
      });
    }

    // 病患卡片：單獨播報台語 / 單獨播報國語（即時切換無延遲）
    const speakPatientTwBtn = document.getElementById('speakPatientTwBtn');
    if (speakPatientTwBtn) {
      speakPatientTwBtn.addEventListener('click', () => {
        const step = this.getCurrentStep();
        this.audioEngine.speakPrompt({
          stepId: step.id,
          patientText: step.voicePrompt.patient,
          patientTwAudioUrl: step.taiwaneseAudio?.patient || '',
          patientZhAudioUrl: step.mandarinAudio?.patient || '',
          roleFilter: 'patient',
          forceLang: 'tw',
          chimeType: 'none'
        });
      });
    }

    const speakPatientOnlyBtn = document.getElementById('speakPatientOnlyBtn');
    if (speakPatientOnlyBtn) {
      speakPatientOnlyBtn.addEventListener('click', () => {
        const step = this.getCurrentStep();
        this.audioEngine.speakPrompt({
          stepId: step.id,
          patientText: step.voicePrompt.patient,
          patientTwAudioUrl: step.taiwaneseAudio?.patient || '',
          patientZhAudioUrl: step.mandarinAudio?.patient || '',
          roleFilter: 'patient',
          forceLang: 'zh',
          chimeType: 'none'
        });
      });
    }

    // 醫護人員卡片：單獨播報國語 / 單獨播報台語（即時切換無延遲）
    const speakStaffOnlyBtn = document.getElementById('speakStaffOnlyBtn');
    if (speakStaffOnlyBtn) {
      speakStaffOnlyBtn.addEventListener('click', () => {
        const step = this.getCurrentStep();
        this.audioEngine.speakPrompt({
          stepId: step.id,
          staffText: step.voicePrompt.staff,
          staffTwAudioUrl: step.taiwaneseAudio?.staff || '',
          staffZhAudioUrl: step.mandarinAudio?.staff || '',
          roleFilter: 'staff',
          forceLang: 'zh',
          chimeType: 'none'
        });
      });
    }

    const speakStaffTwBtn = document.getElementById('speakStaffTwBtn');
    if (speakStaffTwBtn) {
      speakStaffTwBtn.addEventListener('click', () => {
        const step = this.getCurrentStep();
        this.audioEngine.speakPrompt({
          stepId: step.id,
          staffText: step.voicePrompt.staff,
          staffTwAudioUrl: step.taiwaneseAudio?.staff || '',
          staffZhAudioUrl: step.mandarinAudio?.staff || '',
          roleFilter: 'staff',
          forceLang: 'tw',
          chimeType: 'none'
        });
      });
    }

    const pauseResumeTimerBtn = document.getElementById('pauseResumeTimerBtn');
    if (pauseResumeTimerBtn) {
      pauseResumeTimerBtn.addEventListener('click', () => {
        const step = this.getCurrentStep();
        if (step && !step.hasTimer) {
          // 非計時階段：控制語音暫停與繼續
          if (this.audioEngine.isSpeaking) {
            const replayVoiceBtn = document.getElementById('replayVoiceBtn');
            if (this.audioEngine._isVoicePaused) {
              this.audioEngine.resumeVoice();
              pauseResumeTimerBtn.textContent = '⏸ 暫停';
              if (replayVoiceBtn) replayVoiceBtn.disabled = true;
            } else {
              this.audioEngine.pauseVoice();
              pauseResumeTimerBtn.textContent = '▶ 繼續';
              if (replayVoiceBtn) replayVoiceBtn.disabled = false;
            }
          }
        } else {
          // 計時階段：控制計時器暫停與繼續
          this.toggleTimerPause();
        }
      });
    }

    const nextStepBtn = document.getElementById('nextStepBtn');
    if (nextStepBtn) {
      nextStepBtn.addEventListener('click', () => {
        const steps = this.getActiveSteps();
        if (this.currentStepIndex < steps.length - 1) {
          this.completedStepIds.add(this.getCurrentStep().id);
          this._loadStep(this.currentStepIndex + 1, { autoSpeak: true });
        }
      });
    }

    const emergencyAbortBtn = document.getElementById('emergencyAbortBtn');
    if (emergencyAbortBtn) {
      emergencyAbortBtn.addEventListener('click', () => {
        this.handleEmergencyAbort();
      });
    }

    // 手機／平板專用：第一部分與第二部分快速雙頁箋切換控制
    const mobileShowPart1Btn = document.getElementById('mobileShowPart1Btn');
    const mobileShowPart2Btn = document.getElementById('mobileShowPart2Btn');
    const jumpToRecordBtn = document.getElementById('jumpToRecordBtn');

    if (mobileShowPart1Btn) {
      mobileShowPart1Btn.addEventListener('click', () => {
        this.switchMobilePartView('part1');
        this.scrollToMobileSwitcher();
      });
    }
    if (mobileShowPart2Btn) {
      mobileShowPart2Btn.addEventListener('click', () => {
        this.switchMobilePartView('part2');
        this.scrollToMobileSwitcher();
      });
    }
    if (jumpToRecordBtn) {
      jumpToRecordBtn.addEventListener('click', () => {
        if (jumpToRecordBtn.disabled) return;
        const step = this.getCurrentStep();
        const targetStageKey = step.recordStageKey || (step.id === 'supine_rest' ? 'supine' : null);
        this.switchMobilePartView('part2');
        if (targetStageKey) {
          this._highlightActiveRecordBox(targetStageKey, true);
          const targetBox = document.getElementById(`record-box-${targetStageKey}`);
          if (targetBox && typeof targetBox.scrollIntoView === 'function') {
            setTimeout(() => {
              targetBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 80);
          }
        } else {
          this.scrollToMobileSwitcher();
        }
      });
    }
  }

  /**
   * 滾動至「語音指導」/「記錄血壓與判讀」切換按鈕列
   * 採用絕對幾何座標常數鎖定，徹底消除因頁面高度動態折疊導致的瀏覽器 Clamp 差異，
   * 確保平躺、1分鐘、3分鐘返回與直接點擊語音指導頁籤時，停靠位置 100% 絕對完全一致！
   */
  scrollToMobileSwitcher() {
    const header = document.querySelector('.app-header');
    const switcher = document.getElementById('mobilePartSwitcher');
    const workspace = document.getElementById('tab-workspace');
    const isMobile = switcher && window.getComputedStyle(switcher).display !== 'none';

    let targetY = 0;
    if (isMobile) {
      targetY = header ? (header.offsetTop + header.offsetHeight) : 56;
    } else if (workspace) {
      targetY = Math.max(0, workspace.offsetTop - 12);
    }

    // 先以 instant (auto) 模式立即校準，防範 Part 2 頁面高度瞬間崩塌產生的 Clamp 與視窗跳動
    window.scrollTo({ top: targetY, behavior: 'auto' });

    // 接續在下一個渲染幀進行平滑過渡
    requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    });

    // 在 40ms 與 80ms 雙重微幀再次確保絕對鎖死在該座標，百分之百消除各階段返回落點微差
    setTimeout(() => {
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    }, 40);
    setTimeout(() => {
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    }, 80);
  }

  /**
   * 滾動至「步驟一到步驟六按鈕那一列」(stepperTrack)
   */
  scrollToStepperTrack() {
    setTimeout(() => {
      const track = document.getElementById('stepperTrack');
      if (!track) return;
      const switcher = document.getElementById('mobilePartSwitcher');
      const isSwitcherVisible = switcher && window.getComputedStyle(switcher).display !== 'none';
      const offset = isSwitcherVisible ? (switcher.offsetHeight + 12) : 16;
      const trackY = track.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: Math.max(0, trackY), behavior: 'smooth' });
    }, 40);
  }

  /**
   * 切換手機／平板視圖模式 ('part1' | 'part2')
   */
  switchMobilePartView(mode) {
    const grid = document.getElementById('workspaceGrid');
    const btn1 = document.getElementById('mobileShowPart1Btn');
    const btn2 = document.getElementById('mobileShowPart2Btn');
    const btn1Text = document.getElementById('mobilePart1BtnText');
    if (!grid) return;

    grid.classList.remove('mobile-view-part1', 'mobile-view-part2');
    if (btn1) btn1.classList.remove('active');
    if (btn2) btn2.classList.remove('active');

    if (mode === 'part1') {
      grid.classList.add('mobile-view-part1');
      if (btn1) btn1.classList.add('active');
      if (btn1Text) btn1Text.textContent = '⏱️ 語音指導';
    } else {
      grid.classList.add('mobile-view-part2');
      if (btn2) btn2.classList.add('active');
      if (btn1Text) btn1Text.textContent = '⬅️ 語音指導';
    }
  }

  _speakStepVoice(step) {
    if (!step) return;
    this.audioEngine.speakPrompt({
      stepId: step.id,
      patientText: step.voicePrompt?.patient || '',
      staffText: step.voicePrompt?.staff || '',
      patientTwAudioUrl: step.taiwaneseAudio?.patient || '',
      staffTwAudioUrl: step.taiwaneseAudio?.staff || '',
      patientZhAudioUrl: step.mandarinAudio?.patient || '',
      staffZhAudioUrl: step.mandarinAudio?.staff || '',
      chimeType: 'normal'
    });
  }

  _renderStepper() {
    const track = document.getElementById('stepperTrack');
    if (!track) return;

    const steps = this.getActiveSteps();
    track.innerHTML = '';

    steps.forEach((step, idx) => {
      const node = document.createElement('div');
      node.className = 'step-node';
      const isCurrent = idx === this.currentStepIndex;
      if (isCurrent) node.classList.add('active');
      if (this.completedStepIds.has(step.id)) node.classList.add('completed');

      const durSec = this.getStepDurationSec(step);
      const timeHint = step.hasTimer
        ? `⏱️ ${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, '0')}`
        : '🔊 語音指引';

      node.innerHTML = `
        <span class="step-node-num">步驟 ${idx + 1} · ${timeHint}</span>
        <span class="step-node-title">${isCurrent ? '▶ ' : ''}${step.shortTitle}</span>
      `;
      node.title = isCurrent
        ? '點擊立即播報本階段語音與啟動計時'
        : `點擊切換至「${step.shortTitle}」`;

      node.addEventListener('click', () => {
        if (idx === this.currentStepIndex) {
          this.startCurrentStepAction();
        } else {
          this._loadStep(idx, { autoSpeak: false });
        }
      });

      track.appendChild(node);

      // 在手機水平滾動條上自動將當前步驟節點水平滑至軌道中央（純水平滾動，絕不干擾整頁垂直視窗）
      if (idx === this.currentStepIndex) {
        setTimeout(() => {
          if (track && node) {
            const scrollLeft = node.offsetLeft - (track.clientWidth / 2) + (node.clientWidth / 2);
            track.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
          }
        }, 60);
      }
    });
  }

  _loadStep(index, { autoSpeak = false } = {}) {
    const steps = this.getActiveSteps();
    if (index < 0 || index >= steps.length) return;

    this._stopTimer();
    this.audioEngine.stopRelaxingMusic();
    this.audioEngine.stopSpeech();
    clearTimeout(this._voiceProgressHideTimeout);

    this.currentStepIndex = index;
    const step = steps[index];

    this._renderStepper();

    const stageTitleEl = document.getElementById('currentStageTitle');
    const stageBadgeEl = document.getElementById('currentStageBadge');
    const patientInstructionEl = document.getElementById('patientInstructionText');
    const patientTwSubEl = document.getElementById('patientTaiwaneseSubText');
    const staffInstructionEl = document.getElementById('staffInstructionText');

    if (stageTitleEl) stageTitleEl.textContent = step.fullTitle;
    if (stageBadgeEl) stageBadgeEl.textContent = step.badgeText;
    if (patientInstructionEl) patientInstructionEl.textContent = step.patientInstruction;
    if (patientTwSubEl) patientTwSubEl.textContent = step.patientTaiwaneseSub || '';
    if (staffInstructionEl) staffInstructionEl.textContent = step.staffInstruction;

    this.timerTotalSec = this.getStepDurationSec(step);
    this.timerRemainingSec = this.timerTotalSec;
    this.preAlertTriggered = false;
    this._updateTimerUI();

    const primaryBtn = document.getElementById('primaryStepActionBtn');
    const replayVoiceBtn = document.getElementById('replayVoiceBtn');
    const pauseBtn = document.getElementById('pauseResumeTimerBtn');
    const nextBtn = document.getElementById('nextStepBtn');
    const jumpToRecordBtn = document.getElementById('jumpToRecordBtn');

    if (replayVoiceBtn) {
      replayVoiceBtn.disabled = false;
    }

    if (primaryBtn) {
      primaryBtn.disabled = false;
      if (step.hasTimer) {
        primaryBtn.innerHTML = `▶ 開始「${step.shortTitle}」語音引導與計時`;
      } else {
        primaryBtn.innerHTML = `🔊 播報「${step.shortTitle}」雙角色語音提示`;
      }
    }

    if (pauseBtn) {
      pauseBtn.disabled = !step.hasTimer;
      pauseBtn.textContent = '⏸ 暫停';
    }

    if (nextBtn) {
      nextBtn.disabled = index >= steps.length - 1;
    }

    // 控制「前往輸入血壓與心跳數值」按鈕：在步驟一（測量前準備）及無需測量的靜息階段設為不可啟動 (disabled)
    if (jumpToRecordBtn) {
      if (step.recordStageKey) {
        jumpToRecordBtn.disabled = false;
        jumpToRecordBtn.innerHTML = `📝 前往輸入「${step.shortTitle}」血壓與心跳 ➔`;
      } else if (step.id === 'complete') {
        jumpToRecordBtn.disabled = false;
        jumpToRecordBtn.innerHTML = `📊 前往檢視臨床判讀結果與儲存紀錄 ➔`;
      } else {
        jumpToRecordBtn.disabled = true;
        jumpToRecordBtn.innerHTML = `📝 本階段（${step.shortTitle}）無需記錄血壓與心跳`;
      }
    }

    this._highlightActiveRecordBox(step.recordStageKey);

    if (autoSpeak) {
      this.startCurrentStepAction();
    }
  }

  startCurrentStepAction() {
    const step = this.getCurrentStep();
    const primaryBtn = document.getElementById('primaryStepActionBtn');
    if (primaryBtn) {
      primaryBtn.disabled = true;
    }
    this._speakStepVoice(step);

    if (step.hasTimer) {
      this._startTimer(step);
      if (step.playMusicDuringTimer && this.audioEngine.musicEnabled) {
        this.audioEngine.startRelaxingMusic();
      }
    }
  }

  _startTimer(step) {
    this._stopTimer();
    this.timerTotalSec = this.getStepDurationSec(step);
    this.timerRemainingSec = this.timerTotalSec;
    this.preAlertTriggered = false;
    this.timerRunning = true;

    const primaryBtn = document.getElementById('primaryStepActionBtn');
    if (primaryBtn) {
      primaryBtn.disabled = true;
    }

    const pauseBtn = document.getElementById('pauseResumeTimerBtn');
    if (pauseBtn) {
      pauseBtn.disabled = false;
      pauseBtn.textContent = '⏸ 暫停';
    }

    this._updateTimerUI();

    this.timerInterval = setInterval(() => {
      if (!this.timerRunning) return;

      this.timerRemainingSec = Math.max(0, this.timerRemainingSec - 1);
      this._updateTimerUI();

      const preAlertPoint = this.quickDemoMode ? 5 : (step.preAlertSec || 15);
      if (
        !this.preAlertTriggered &&
        this.timerRemainingSec === preAlertPoint &&
        step.voicePrompt?.preAlert
      ) {
        this.preAlertTriggered = true;
        this.audioEngine.speakPrompt({
          singleText: step.voicePrompt.preAlert,
          singleTwAudioUrl: step.taiwaneseAudio?.preAlert || 'audio/taiwanese/pre_alert.mp3',
          singleZhAudioUrl: step.mandarinAudio?.preAlert || '',
          chimeType: 'alert'
        });
      }

      if (this.timerRemainingSec <= 0) {
        this._onTimerCompleted(step);
      }
    }, 1000);
  }

  toggleTimerPause() {
    const step = this.getCurrentStep();
    if (!step.hasTimer || this.timerTotalSec === 0) return;

    const pauseBtn = document.getElementById('pauseResumeTimerBtn');
    if (this.timerRunning) {
      this.timerRunning = false;
      this.audioEngine.stopRelaxingMusic();
      if (pauseBtn) pauseBtn.textContent = '▶ 繼續';
    } else {
      if (this.timerRemainingSec <= 0) {
        this.timerRemainingSec = this.timerTotalSec;
      }
      this.timerRunning = true;
      if (step.playMusicDuringTimer && this.audioEngine.musicEnabled) {
        this.audioEngine.startRelaxingMusic();
      }
      if (pauseBtn) pauseBtn.textContent = '⏸ 暫停';
    }
    this._updateTimerUI();
  }

  _stopTimer() {
    this.timerRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  _onTimerCompleted(step) {
    this._stopTimer();
    this.audioEngine.stopRelaxingMusic();
    this.audioEngine.stopSpeech();
    clearTimeout(this._voiceProgressHideTimeout);
    const progressWrap = document.getElementById('voiceProgressContainer');
    if (progressWrap) progressWrap.style.display = 'none';
    this.completedStepIds.add(step.id);
    this._renderStepper();
    this._updateTimerUI();

    const primaryBtn = document.getElementById('primaryStepActionBtn');
    if (primaryBtn) {
      primaryBtn.disabled = false;
      primaryBtn.innerHTML = `🔄 重新開始「${step.shortTitle}」語音引導與計時`;
    }

    if (step.voicePrompt?.timerDone) {
      this.audioEngine.speakPrompt({
        singleText: step.voicePrompt.timerDone,
        singleTwAudioUrl: step.taiwaneseAudio?.timerDone || 'audio/taiwanese/timer_done.mp3',
        singleZhAudioUrl: step.mandarinAudio?.timerDone || '',
        chimeType: 'done'
      });
    }

    const jumpToRecordBtn = document.getElementById('jumpToRecordBtn');
    if (step.id === 'supine_rest') {
      if (jumpToRecordBtn) {
        jumpToRecordBtn.disabled = false;
        jumpToRecordBtn.innerHTML = `📝 前往輸入「平躺基準值」血壓與心跳 ➔`;
      }
      this._highlightActiveRecordBox('supine', true);
    } else if (step.recordStageKey) {
      this._highlightActiveRecordBox(step.recordStageKey, true);
    }

    this.showToast(`🔔 「${step.shortTitle}」計時完成！請立即測量血壓與心跳並記錄於右側。`);
  }

  _updateTimerUI() {
    const step = this.getCurrentStep();
    const digitsEl = document.getElementById('timerDigits');
    const subtextEl = document.getElementById('timerSubtext');
    const progressCircle = document.getElementById('timerCircleProgress');
    const mobileMiniBadge = document.getElementById('mobileMiniTimerBadge');

    const circumference = 534;

    if (!step.hasTimer) {
      if (this.audioEngine && this.audioEngine.isSpeaking) {
        return;
      }
      if (digitsEl) digitsEl.textContent = '手動確認';
      if (subtextEl) subtextEl.textContent = '完成動作後點下一階段';
      if (mobileMiniBadge) {
        const miniBadgeMap = {
          prep: '準備',
          supine_measure: '量平躺',
          complete: '完成'
        };
        mobileMiniBadge.textContent = miniBadgeMap[step.id] || '手動';
      }
      if (progressCircle) {
        progressCircle.style.strokeDashoffset = '0';
        progressCircle.classList.remove('pre-alert', 'done', 'voice-progress-stroke');
      }
      return;
    }

    const mins = Math.floor(this.timerRemainingSec / 60);
    const secs = this.timerRemainingSec % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (digitsEl) digitsEl.textContent = formatted;
    if (mobileMiniBadge) {
      mobileMiniBadge.textContent = this.timerRemainingSec === 0 ? '量血壓' : formatted;
    }

    if (subtextEl) {
      if (this.timerRemainingSec === 0) {
        subtextEl.textContent = '✅ 計時完成！請測量血壓';
      } else if (this.timerRunning) {
        subtextEl.textContent = step.playMusicDuringTimer
          ? '倒數計時中 · 輕音樂舒緩'
          : '倒數計時中...';
      } else {
        subtextEl.textContent = '點擊主按鈕開始計時';
      }
    }

    if (progressCircle) {
      const ratio = this.timerTotalSec > 0 ? this.timerRemainingSec / this.timerTotalSec : 1;
      const offset = circumference * (1 - ratio);
      progressCircle.style.strokeDashoffset = String(offset);

      progressCircle.classList.remove('pre-alert', 'done');
      const preAlertPoint = this.quickDemoMode ? 5 : (step.preAlertSec || 15);
      if (this.timerRemainingSec === 0) {
        progressCircle.classList.add('done');
      } else if (this.timerRemainingSec <= preAlertPoint) {
        progressCircle.classList.add('pre-alert');
      }
    }
  }

  /**
   * 專供無倒數計時階段（例如步驟一測量前準備、步驟三平躺測量、步驟七測量完成）之語音即時進度處理
   */
  _handleVoiceProgress(prog) {
    const step = this.getCurrentStep();
    const digitsEl = document.getElementById('timerDigits');
    const subtextEl = document.getElementById('timerSubtext');
    const progressCircle = document.getElementById('timerCircleProgress');
    const mobileMiniBadge = document.getElementById('mobileMiniTimerBadge');
    const replayBtn = document.getElementById('replayVoiceBtn');
    const primaryBtn = document.getElementById('primaryStepActionBtn');
    const pauseBtn = document.getElementById('pauseResumeTimerBtn');

    if (!step || step.hasTimer) {
      return;
    }

    // 步驟隔離防護：若收到非當前階段的非同步語音進度，直接忽略，避免跨步驟污染
    if (prog.stepId && step && prog.stepId !== step.id) {
      return;
    }

    const circumference = 534;

    const formatSec = (sec) => {
      const s = Math.max(0, Math.floor(sec || 0));
      const m = Math.floor(s / 60);
      const rem = s % 60;
      return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    };

    const miniBadgeMap = { prep: '準備', supine_measure: '量平躺', complete: '完成' };

    if (prog.active) {
      // 聯動中央圓形計時器顯示即時秒數與狀態
      if (digitsEl) {
        digitsEl.textContent = formatSec(prog.elapsedSec);
      }
      if (subtextEl) {
        subtextEl.textContent = prog.isPaused
          ? '⏸ 語音已暫停'
          : `🔊 ${prog.roleLabel || '語音播報中'}`;
      }
      if (mobileMiniBadge) {
        mobileMiniBadge.textContent = prog.isPaused ? '暫停' : '播報中';
      }
      if (progressCircle) {
        const offset = circumference * (1 - (prog.percent || 0) / 100);
        progressCircle.style.strokeDashoffset = String(offset);
        progressCircle.classList.add('voice-progress-stroke');
        progressCircle.classList.remove('done', 'pre-alert');
      }

      // 按鈕狀態控制：播報中禁用主播報鍵；在暫停時開啟重播功能
      if (primaryBtn) primaryBtn.disabled = true;
      if (pauseBtn) {
        pauseBtn.disabled = false;
        pauseBtn.textContent = prog.isPaused ? '▶ 繼續' : '⏸ 暫停';
      }
      if (replayBtn) {
        replayBtn.disabled = !prog.isPaused;
      }
    } else if (prog.completed) {
      // 播報完成狀態 (100%)
      if (digitsEl) {
        digitsEl.textContent = '手動確認';
      }
      if (subtextEl) {
        subtextEl.textContent = '✅ 播報完畢，請點下一階段';
      }
      if (mobileMiniBadge) {
        mobileMiniBadge.textContent = miniBadgeMap[step.id] || '手動';
      }
      if (progressCircle) {
        progressCircle.style.strokeDashoffset = '0';
        progressCircle.classList.add('done');
        progressCircle.classList.remove('voice-progress-stroke', 'pre-alert');
      }

      // 恢復按鈕可操作狀態
      if (replayBtn) replayBtn.disabled = false;
      if (primaryBtn) primaryBtn.disabled = false;
      if (pauseBtn) {
        pauseBtn.disabled = true;
        pauseBtn.textContent = '⏸ 暫停';
      }
    } else {
      // 停止或重設
      if (replayBtn) replayBtn.disabled = false;
      if (primaryBtn) primaryBtn.disabled = false;
      if (pauseBtn) {
        pauseBtn.disabled = !step.hasTimer;
        pauseBtn.textContent = '⏸ 暫停';
      }

      if (!step.hasTimer) {
        if (digitsEl) digitsEl.textContent = '手動確認';
        if (subtextEl) subtextEl.textContent = '完成動作後點下一階段';
        if (mobileMiniBadge) {
          mobileMiniBadge.textContent = miniBadgeMap[step.id] || '手動';
        }
        if (progressCircle) {
          progressCircle.style.strokeDashoffset = '0';
          progressCircle.classList.remove('pre-alert', 'done', 'voice-progress-stroke');
        }
      }
    }
  }

  handleEmergencyAbort() {
    this._stopTimer();
    this.audioEngine.stopRelaxingMusic();
    this.audioEngine.stopSpeech();
    clearTimeout(this._voiceProgressHideTimeout);
    const progressWrap = document.getElementById('voiceProgressContainer');
    if (progressWrap) progressWrap.style.display = 'none';

    this.currentRecord.abortedEarly = true;
    this.currentRecord.abortReason = '站立期間出現明顯頭暈、眼花或站立不穩';

    const step = this.getCurrentStep();
    const stageKey = step.recordStageKey || 'stand1';
    if (this.currentRecord.measurements[stageKey]) {
      const sym = new Set(this.currentRecord.measurements[stageKey].symptoms.filter(s => s !== 'none'));
      sym.add('dizziness');
      sym.add('presyncope');
      this.currentRecord.measurements[stageKey].symptoms = Array.from(sym);
    }

    this.audioEngine.speakPrompt({
      singleText: '緊急安全提示！病患出現不適症狀，請醫護人員立即攙扶病患坐下或平躺休息，避免跌倒，並立即測量目前的血壓與心跳。',
      singleTwAudioUrl: 'audio/taiwanese/emergency_abort.mp3',
      singleZhAudioUrl: 'audio/mandarin/emergency_abort.mp3',
      chimeType: 'alert'
    });

    this._renderMeasurementStages();
    this._updateClinicalAssessment();
    this.showToast('⚠️ 已啟動病患安全中止程序，請立即協助病患坐下或躺平！');
  }

  _renderMeasurementStages() {
    const container = document.getElementById('measurementStagesContainer');
    if (!container) return;

    const stageConfigs = [
      {
        key: 'supine',
        title: '1. 平躺基準值 (Supine Baseline)',
        timeTag: '平躺滿 5 分鐘',
        isBaseline: true
      },
      ...(this.includeSittingStep
        ? [
            {
              key: 'sitting',
              title: '2. 坐姿過渡測量 (Sitting)',
              timeTag: '坐起 1 分鐘',
              isBaseline: false
            }
          ]
        : []),
      {
        key: 'stand1',
        title: `${this.includeSittingStep ? '3' : '2'}. 站立第 1 分鐘 (Standing 1 min)`,
        timeTag: '站立滿 1 分鐘',
        isBaseline: false
      },
      {
        key: 'stand3',
        title: `${this.includeSittingStep ? '4' : '3'}. 站立第 3 分鐘 (Standing 3 min)`,
        timeTag: '站立滿 3 分鐘',
        isBaseline: false
      }
    ];

    container.innerHTML = '';

    stageConfigs.forEach(cfg => {
      const stageData = this.currentRecord.measurements[cfg.key] || {
        sbp: '',
        dbp: '',
        hr: '',
        symptoms: ['none']
      };

      const returnBtnLabel = cfg.key === 'stand3'
        ? '⬅️ 站立 3 分鐘數值已記錄，返回「語音指導」完成判讀 ➔'
        : (cfg.key === 'stand1'
            ? '⬅️ 站立 1 分鐘數值已記錄，返回「語音指導」下一階段 ➔'
            : (cfg.key === 'sitting'
                ? '⬅️ 坐姿數值已記錄，返回「語音指導」下一階段 ➔'
                : '⬅️ 平躺基準數值已記錄，返回「語音指導」下一階段 ➔'));

      const box = document.createElement('div');
      box.className = 'stage-record-box';
      box.id = `record-box-${cfg.key}`;
      box.setAttribute('data-stage-key', cfg.key);

      box.innerHTML = `
        <div class="stage-record-header">
          <div class="stage-record-title">
            <span>${cfg.title}</span>
            <span class="stage-time-tag">${cfg.timeTag}</span>
          </div>
          <div class="delta-pills-group" id="delta-group-${cfg.key}">
            ${cfg.isBaseline ? '<span class="delta-pill">基準比較點 (Baseline)</span>' : ''}
          </div>
        </div>

        <div class="bp-inputs-row">
          <div class="bp-input-group">
            <label for="input-${cfg.key}-sbp">收縮壓 (SBP)</label>
            <div class="bp-input-wrapper">
              <input type="number" inputmode="numeric" pattern="[0-9]*" enterkeyhint="next" id="input-${cfg.key}-sbp" min="40" max="280" placeholder="" value="${stageData.sbp}" data-stage="${cfg.key}" data-field="sbp" />
              <span class="bp-unit">mmHg</span>
            </div>
          </div>

          <div class="bp-input-group">
            <label for="input-${cfg.key}-dbp">舒張壓 (DBP)</label>
            <div class="bp-input-wrapper">
              <input type="number" inputmode="numeric" pattern="[0-9]*" enterkeyhint="next" id="input-${cfg.key}-dbp" min="20" max="180" placeholder="" value="${stageData.dbp}" data-stage="${cfg.key}" data-field="dbp" />
              <span class="bp-unit">mmHg</span>
            </div>
          </div>

          <div class="bp-input-group">
            <label for="input-${cfg.key}-hr">心跳 (HR)</label>
            <div class="bp-input-wrapper">
              <input type="number" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" id="input-${cfg.key}-hr" min="30" max="220" placeholder="" value="${stageData.hr}" data-stage="${cfg.key}" data-field="hr" />
              <span class="bp-unit">bpm</span>
            </div>
          </div>
        </div>

        <details class="symptoms-details ${(stageData.symptoms || []).some(s => s !== 'none') ? 'has-active-symptom' : ''}" id="symptoms-details-${cfg.key}" ${(stageData.symptoms || []).some(s => s !== 'none') ? 'open' : ''}>
          <summary>
            <span>${(stageData.symptoms || []).some(s => s !== 'none') ? '⚠️ 伴隨症狀：' : '🟢 伴隨症狀：'}${window.OHClinicalEvaluator.formatSymptomsText(stageData.symptoms)}</span>
          </summary>
          <div class="symptoms-row" id="symptoms-row-${cfg.key}"></div>
        </details>

        <div class="stage-return-action no-print">
          <button type="button" class="btn-stage-return" data-return-stage="${cfg.key}">
            ${returnBtnLabel}
          </button>
        </div>
      `;

      const symptomsRow = box.querySelector(`#symptoms-row-${cfg.key}`);
      (window.OH_SYMPTOM_OPTIONS || []).forEach(opt => {
        const chip = document.createElement('button');
        chip.type = 'button';
        const isSelected = (stageData.symptoms || []).includes(opt.id);
        chip.className = 'symptom-chip';
        if (isSelected) {
          chip.classList.add(opt.isNormal ? 'selected-normal' : 'selected-symptom');
        }
        chip.textContent = opt.label;

        chip.addEventListener('click', () => {
          this._toggleStageSymptom(cfg.key, opt.id);
        });

        symptomsRow.appendChild(chip);
      });

      const stageReturnBtn = box.querySelector('.btn-stage-return');
      if (stageReturnBtn) {
        stageReturnBtn.addEventListener('click', () => {
          const steps = this.getActiveSteps();
          const stepIndexForStage = steps.findIndex(s => s.recordStageKey === cfg.key);
          const targetNextIndex = (stepIndexForStage !== -1) ? stepIndexForStage + 1 : this.currentStepIndex + 1;

          if (stepIndexForStage !== -1) {
            for (let i = 0; i <= stepIndexForStage; i++) {
              this.completedStepIds.add(steps[i].id);
            }
          }

          if (targetNextIndex < steps.length) {
            this._loadStep(targetNextIndex, { autoSpeak: false });
          }

          this.switchMobilePartView('part1');
          this.scrollToMobileSwitcher();

          const currentStep = this.getCurrentStep();
          if (cfg.key === 'stand3') {
            this.showToast(`✅ 已記錄「站立第 3 分鐘」數值！全階段已完成，前往「${currentStep ? currentStep.shortTitle : '測量完成與判讀'}」。`);
          } else if (cfg.key === 'stand1') {
            this.showToast(`✅ 已記錄「站立第 1 分鐘」數值！已自動為您跳至下一階段「${currentStep ? currentStep.shortTitle : '站立第 3 分鐘'}」。`);
          } else if (cfg.key === 'sitting') {
            this.showToast(`✅ 已記錄「坐姿過渡測量」數值！已自動為您跳至下一階段「${currentStep ? currentStep.shortTitle : '站立第 1 分鐘'}」。`);
          } else {
            this.showToast(`✅ 已記錄「平躺基準值」數值！已自動為您跳至下一階段「${currentStep ? currentStep.shortTitle : '站立第 1 分鐘'}」。`);
          }
        });
      }

      container.appendChild(box);
    });

    const inputs = container.querySelectorAll('input[type="number"]');
    inputs.forEach((input, idx) => {
      input.addEventListener('input', (e) => {
        const stageKey = e.target.getAttribute('data-stage');
        const field = e.target.getAttribute('data-field');
        if (this.currentRecord.measurements[stageKey]) {
          this.currentRecord.measurements[stageKey][field] = e.target.value;
          this._updateClinicalAssessment();
        }
      });

      // 手機／平板鍵盤按下「下一項 / Enter」時自動跳至下一個輸入框 (SBP -> DBP -> HR)
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const field = input.getAttribute('data-field');
          if (field === 'hr') {
            input.blur();
          } else if (inputs[idx + 1]) {
            inputs[idx + 1].focus();
          }
        }
      });
    });

    const curStep = this.getCurrentStep();
    this._highlightActiveRecordBox(curStep?.recordStageKey);
  }

  _toggleStageSymptom(stageKey, symptomId) {
    const stage = this.currentRecord.measurements[stageKey];
    if (!stage) return;

    let current = Array.isArray(stage.symptoms) ? [...stage.symptoms] : ['none'];

    if (symptomId === 'none') {
      current = ['none'];
    } else {
      current = current.filter(id => id !== 'none');
      if (current.includes(symptomId)) {
        current = current.filter(id => id !== symptomId);
        if (current.length === 0) current = ['none'];
      } else {
        current.push(symptomId);
      }
    }

    stage.symptoms = current;
    this._renderMeasurementStages();
    this._updateClinicalAssessment();
  }

  _highlightActiveRecordBox(stageKey, focusInput = false) {
    document.querySelectorAll('.stage-record-box').forEach(box => {
      box.classList.remove('active-focus');
    });
    if (!stageKey) return;

    const targetBox = document.getElementById(`record-box-${stageKey}`);
    if (targetBox) {
      targetBox.classList.add('active-focus');
      if (focusInput) {
        const firstInput = targetBox.querySelector('input');
        if (firstInput) firstInput.focus();
      }
    }
  }

  _updateClinicalAssessment() {
    const evalRes = window.OHClinicalEvaluator.evaluateRecord(this.currentRecord);

    const stageEvalMap = {
      sitting: evalRes.sittingEval,
      stand1: evalRes.stand1Eval,
      stand3: evalRes.stand3Eval
    };

    Object.entries(stageEvalMap).forEach(([key, stEval]) => {
      const groupEl = document.getElementById(`delta-group-${key}`);
      const boxEl = document.getElementById(`record-box-${key}`);
      if (!groupEl || !stEval) return;

      if (boxEl) {
        boxEl.classList.toggle('positive-alert', Boolean(stEval.isStagePositive));
      }

      const sbpText = window.OHClinicalEvaluator.formatDelta(stEval.deltaSbp, 'mmHg');
      const dbpText = window.OHClinicalEvaluator.formatDelta(stEval.deltaDbp, 'mmHg');
      const hrText = window.OHClinicalEvaluator.formatDelta(stEval.deltaHr, 'bpm');

      groupEl.innerHTML = `
        <span class="delta-pill ${stEval.sbpDropMet ? 'drop-positive' : ''}">
          ΔSBP: ${sbpText} ${stEval.sbpDropMet ? '⚠️(降≥20)' : ''}
        </span>
        <span class="delta-pill ${stEval.dbpDropMet ? 'drop-positive' : ''}">
          ΔDBP: ${dbpText} ${stEval.dbpDropMet ? '⚠️(降≥10)' : ''}
        </span>
        <span class="delta-pill">
          ΔHR: ${hrText}
        </span>
      `;
    });

    const banner = document.getElementById('clinicalAssessmentBanner');
    const headlineEl = document.getElementById('assessmentHeadline');
    const summaryEl = document.getElementById('assessmentSummary');
    const notesListEl = document.getElementById('assessmentNotesList');

    if (banner) {
      banner.className = `assessment-banner status-${evalRes.status}`;
    }
    if (headlineEl) {
      const iconMap = {
        pending: '🩺',
        normal: '✅',
        positive: '🚨',
        symptomatic_borderline: '⚠️'
      };
      headlineEl.textContent = `${iconMap[evalRes.status] || '🩺'} ${evalRes.headline}`;
    }
    if (summaryEl) {
      summaryEl.textContent = evalRes.summaryText;
    }
    if (notesListEl) {
      notesListEl.innerHTML = '';
      (evalRes.clinicalNotes || []).forEach(note => {
        const li = document.createElement('li');
        li.textContent = note;
        notesListEl.appendChild(li);
      });
    }
  }

  _bindRecordFormInputs() {
    const fieldMap = [
      { id: 'patientChartId', key: 'chartId' },
      { id: 'patientName', key: 'name' },
      { id: 'patientAge', key: 'age' },
      { id: 'patientGender', key: 'gender' },
      { id: 'patientArm', key: 'arm' },
      { id: 'patientCuffSize', key: 'cuffSize' },
      { id: 'patientNotes', key: 'notes' }
    ];

    fieldMap.forEach(({ id, key }) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', (e) => {
          this.currentRecord.patient[key] = e.target.value;
        });
      }
    });

    const measuredAtInput = document.getElementById('patientMeasuredAt');
    if (measuredAtInput) {
      measuredAtInput.addEventListener('input', (e) => {
        this.currentRecord.measuredAtInput = e.target.value;
        this.currentRecord.measuredAt = (e.target.value || '').replace('T', ' ');
      });
    }

    const loadDemoCaseBtn = document.getElementById('loadDemoCaseBtn');
    if (loadDemoCaseBtn) {
      loadDemoCaseBtn.addEventListener('click', () => {
        this.currentRecord.patient = {
          chartId: 'TW-880412',
          name: '林○雄 (範例病患)',
          age: '74',
          gender: '男',
          arm: '左手 (Left Arm)',
          cuffSize: '標準成人壓脈帶 (Standard)',
          notes: '主訴近兩週早晨起床或從沙發站起時常感頭暈眼花。'
        };
        this.currentRecord.measurements.supine = {
          sbp: '138',
          dbp: '82',
          hr: '68',
          symptoms: ['none']
        };
        this.currentRecord.measurements.stand1 = {
          sbp: '112',
          dbp: '70',
          hr: '76',
          symptoms: ['dizziness', 'lightheaded']
        };
        this.currentRecord.measurements.stand3 = {
          sbp: '108',
          dbp: '68',
          hr: '78',
          symptoms: ['dizziness', 'blurred_vision']
        };
        this._syncPatientFormFromModel();
        this._renderMeasurementStages();
        this._updateClinicalAssessment();

        // 切換至測量主工作區並自動展開第二部分以檢視數據
        document.querySelector('[data-tab="tab-workspace"]')?.click();
        this.switchMobilePartView('part2');
        if (typeof this.closeSidebar === 'function') this.closeSidebar();

        this.showToast('📋 已帶入典型「姿勢性低血壓陽性」臨床範例數據');
      });
    }

    const resetFormBtn = document.getElementById('resetFormBtn');
    if (resetFormBtn) {
      resetFormBtn.addEventListener('click', async () => {
        const confirmed = await this.showConfirmDialog({
          title: '確認清空重填',
          message: '確定要清空目前的病患測量結果紀錄並重新開始嗎？未儲存的數值將會遺失。',
          confirmText: '確定清空',
          cancelText: '取消',
          isDestructive: true
        });
        if (!confirmed) return;

        this.currentRecord = this._createFreshRecord();
        this.completedStepIds.clear();
        this._syncPatientFormFromModel();
        this._loadStep(0, { autoSpeak: false });
        this._renderMeasurementStages();
        this._updateClinicalAssessment();

        // 切換至測量主工作區第一部分
        document.querySelector('[data-tab="tab-workspace"]')?.click();
        this.switchMobilePartView('part1');
        this.scrollToMobileSwitcher();
        if (typeof this.closeSidebar === 'function') this.closeSidebar();

        this.showToast('🔄 已清空並開啟空白測量表單');
      });
    }

    const saveRecordBtn = document.getElementById('saveRecordBtn');
    if (saveRecordBtn) {
      saveRecordBtn.addEventListener('click', () => {
        const saved = window.OHStorageManager.saveRecord(this.currentRecord);
        this.currentRecord.id = saved.id;
        this._refreshHistoryTable();
        this.showToast('💾 測量紀錄已成功儲存至本機歷史紀錄！');
      });
    }

    const copyClinicalNoteBtn = document.getElementById('copyClinicalNoteBtn');
    if (copyClinicalNoteBtn) {
      copyClinicalNoteBtn.addEventListener('click', () => {
        const noteText = window.OHClinicalEvaluator.generateClinicalNote(this.currentRecord);
        this._copyTextToClipboard(noteText);
        this.showToast('📋 已複製臨床病歷摘要文字！可直接貼上至醫院病歷系統 (HIS)');
      });
    }

    const printReportBtn = document.getElementById('printReportBtn');
    if (printReportBtn) {
      printReportBtn.addEventListener('click', () => {
        window.print();
      });
    }

    const copyAndEmailBtn = document.getElementById('copyAndEmailBtn');
    if (copyAndEmailBtn) {
      copyAndEmailBtn.addEventListener('click', () => {
        const noteText = window.OHClinicalEvaluator.generateClinicalNote(this.currentRecord);
        this._copyTextToClipboard(noteText);

        const p = this.currentRecord.patient || {};
        const patientLabel = [p.name, p.chartId ? `(${p.chartId})` : ''].filter(Boolean).join(' ') || '病患測量紀錄';
        const subject = `姿勢性低血壓測量結果摘要 - ${patientLabel}`;
        const emailBody = noteText.replace(/\r?\n/g, '\r\n');
        const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;

        const mailLink = document.createElement('a');
        mailLink.href = mailtoUrl;
        mailLink.style.display = 'none';
        document.body.appendChild(mailLink);
        mailLink.click();
        document.body.removeChild(mailLink);

        this.showToast('✉️ 已複製摘要！正在開啟郵件程式（若未自動帶入內文，可直接貼上）');
      });
    }
  }

  _syncPatientFormFromModel() {
    const p = this.currentRecord.patient || {};
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? '';
    };
    setVal('patientChartId', p.chartId);
    setVal('patientName', p.name);
    setVal('patientAge', p.age);
    setVal('patientGender', p.gender);
    setVal('patientArm', p.arm || '左手 (Left Arm)');
    setVal('patientCuffSize', p.cuffSize || '標準成人壓脈帶 (Standard)');
    setVal('patientNotes', p.notes);
    setVal('patientMeasuredAt', this.currentRecord.measuredAtInput);
  }

  _bindSettingsControls() {
    const twVoiceSelect = document.getElementById('twVoiceSelect');
    if (twVoiceSelect) {
      twVoiceSelect.addEventListener('change', (e) => {
        this.audioEngine.selectedVoiceURI = e.target.value;
      });
    }

    const speechRateInput = document.getElementById('speechRateInput');
    const speechRateVal = document.getElementById('speechRateVal');
    if (speechRateInput) {
      speechRateInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.audioEngine.speechRate = val;
        if (speechRateVal) speechRateVal.textContent = `${val.toFixed(2)}x`;
      });
    }

    // 1. 台語獨立音量滑桿（主畫面快速滑桿 + 設定頁滑桿雙向同步，最高 400%）
    const taiwaneseVolInput = document.getElementById('taiwaneseVolInput');
    const taiwaneseVolVal = document.getElementById('taiwaneseVolVal');
    const quickTwVolInput = document.getElementById('quickTwVolInput');
    const quickTwVolVal = document.getElementById('quickTwVolVal');

    const syncTwVol = (val) => {
      const v = parseFloat(val);
      this.audioEngine.setTaiwaneseVolume(v);
      const pctText = `${Math.round(v * 100)}%`;
      if (taiwaneseVolInput && parseFloat(taiwaneseVolInput.value) !== v) taiwaneseVolInput.value = v;
      if (quickTwVolInput && parseFloat(quickTwVolInput.value) !== v) quickTwVolInput.value = v;
      if (taiwaneseVolVal) taiwaneseVolVal.textContent = pctText;
      if (quickTwVolVal) quickTwVolVal.textContent = pctText;
    };

    if (taiwaneseVolInput) taiwaneseVolInput.addEventListener('input', (e) => syncTwVol(e.target.value));
    if (quickTwVolInput) quickTwVolInput.addEventListener('input', (e) => syncTwVol(e.target.value));

    // 2. 國語獨立音量滑桿（主畫面快速滑桿 + 設定頁滑桿雙向同步）
    const speechVolInput = document.getElementById('speechVolInput');
    const speechVolVal = document.getElementById('speechVolVal');
    const quickZhVolInput = document.getElementById('quickZhVolInput');
    const quickZhVolVal = document.getElementById('quickZhVolVal');

    const syncZhVol = (val) => {
      const v = parseFloat(val);
      this.audioEngine.setMandarinVolume(v);
      const pctText = `${Math.round(v * 100)}%`;
      if (speechVolInput && parseFloat(speechVolInput.value) !== v) speechVolInput.value = v;
      if (quickZhVolInput && parseFloat(quickZhVolInput.value) !== v) quickZhVolInput.value = v;
      if (speechVolVal) speechVolVal.textContent = pctText;
      if (quickZhVolVal) quickZhVolVal.textContent = pctText;
    };

    if (speechVolInput) speechVolInput.addEventListener('input', (e) => syncZhVol(e.target.value));
    if (quickZhVolInput) quickZhVolInput.addEventListener('input', (e) => syncZhVol(e.target.value));

    const musicStyleSelect = document.getElementById('musicStyleSelect');
    if (musicStyleSelect) {
      musicStyleSelect.addEventListener('change', (e) => {
        const wasPlaying = this.audioEngine.isMusicPlaying;
        this.audioEngine.stopRelaxingMusic();
        this.audioEngine.musicStyle = e.target.value;
        if (wasPlaying) {
          this.audioEngine.startRelaxingMusic();
        }
      });
    }

    const musicVolInput = document.getElementById('musicVolInput');
    const musicVolVal = document.getElementById('musicVolVal');
    if (musicVolInput) {
      musicVolInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.audioEngine.setMusicVolume(val);
        if (musicVolVal) musicVolVal.textContent = `${Math.round(val * 100)}%`;
      });
    }

    const customMusicFileInput = document.getElementById('customMusicFileInput');
    if (customMusicFileInput) {
      customMusicFileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          this.audioEngine.setCustomMusicFile(file);
          if (musicStyleSelect) musicStyleSelect.value = 'custom_mp3';
          this.showToast(`🎵 已載入自訂輕音樂：${file.name}`);
        }
      });
    }

    const durationBindings = [
      { id: 'durSupineRest', key: 'supine_rest' },
      { id: 'durSitting', key: 'sitting_transition' },
      { id: 'durStand1', key: 'stand_1min' },
      { id: 'durStand3', key: 'stand_3min' }
    ];

    durationBindings.forEach(({ id, key }) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', (e) => {
          const sec = Math.max(5, parseInt(e.target.value, 10) || 60);
          this.customDurations[key] = sec;
          const step = this.getCurrentStep();
          if (step.id === key && !this.timerRunning) {
            this.timerTotalSec = this.getStepDurationSec(step);
            this.timerRemainingSec = this.timerTotalSec;
            this._updateTimerUI();
          }
        });
      }
    });

    // 儲存個人化設定至本機
    const saveUserSettingsBtn = document.getElementById('saveUserSettingsBtn');
    if (saveUserSettingsBtn) {
      saveUserSettingsBtn.addEventListener('click', () => {
        this._saveUserSettings();
      });
    }

    // 還原為系統預設值
    const restoreDefaultSettingsBtn = document.getElementById('restoreDefaultSettingsBtn');
    if (restoreDefaultSettingsBtn) {
      restoreDefaultSettingsBtn.addEventListener('click', () => {
        this._restoreDefaultSettings();
      });
    }
  }

  /**
   * 儲存個人化設定至本機 localStorage
   */
  _saveUserSettings() {
    const settings = {
      version: 1,
      savedAt: new Date().toISOString(),
      languageMode: this.audioEngine.languageMode || 'patient_tw_staff_zh',
      speechRate: this.audioEngine.speechRate || 0.96,
      taiwaneseVolume: this.audioEngine.taiwaneseVolume ?? 2.2,
      mandarinVolume: this.audioEngine.mandarinVolume ?? 0.65,
      musicStyle: this.audioEngine.musicStyle || 'piano_pad',
      musicVolume: this.audioEngine.musicVolume ?? 0.45,
      durations: { ...this.customDurations },
      includeSittingStep: Boolean(this.includeSittingStep),
      quickDemoMode: Boolean(this.quickDemoMode)
    };

    try {
      localStorage.setItem('skh_oh_user_settings_v1', JSON.stringify(settings));
      this.showToast('💾 已成功將個人化設定儲存至本機！下次開啟將自動套用。');
    } catch (e) {
      console.warn('儲存個人設定失敗:', e);
      this.showToast('⚠️ 儲存設定失敗，請確認瀏覽器儲存權限。');
    }
  }

  /**
   * 還原個人化設定為系統原廠預設值
   */
  _restoreDefaultSettings() {
    try {
      localStorage.removeItem('skh_oh_user_settings_v1');
    } catch (e) {}

    const defaults = {
      languageMode: 'patient_tw_staff_zh',
      speechRate: 0.96,
      taiwaneseVolume: 2.2,
      mandarinVolume: 0.65,
      musicStyle: 'piano_pad',
      musicVolume: 0.45,
      durations: {
        supine_rest: 300,
        sitting_transition: 60,
        stand_1min: 60,
        stand_3min: 120
      },
      includeSittingStep: false,
      quickDemoMode: false
    };

    this._applySettingsObject(defaults);
    this.showToast('🔄 已成功還原為系統出廠預設設定！');
  }

  /**
   * 自本機 localStorage 載入個人化設定
   */
  _loadUserSettings() {
    try {
      const raw = localStorage.getItem('skh_oh_user_settings_v1');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        this._applySettingsObject(parsed);
      }
    } catch (e) {
      console.warn('載入本機個人設定失敗:', e);
    }
  }

  /**
   * 套用設定物件至模型與所有相關 UI 元件
   */
  _applySettingsObject(cfg) {
    if (!cfg) return;

    // 1. 語言模式
    if (cfg.languageMode) {
      this.audioEngine.languageMode = cfg.languageMode;
      const headerSel = document.getElementById('headerLangModeSelect');
      const settingsSel = document.getElementById('settingsLangModeSelect');
      if (headerSel) headerSel.value = cfg.languageMode;
      if (settingsSel) settingsSel.value = cfg.languageMode;
    }

    // 2. 語速
    if (typeof cfg.speechRate === 'number') {
      this.audioEngine.speechRate = cfg.speechRate;
      const rateInput = document.getElementById('speechRateInput');
      const rateVal = document.getElementById('speechRateVal');
      if (rateInput) rateInput.value = cfg.speechRate;
      if (rateVal) rateVal.textContent = `${cfg.speechRate.toFixed(2)}x`;
    }

    // 3. 台語音量
    if (typeof cfg.taiwaneseVolume === 'number') {
      this.audioEngine.setTaiwaneseVolume(cfg.taiwaneseVolume);
      const twInput = document.getElementById('taiwaneseVolInput');
      const qTwInput = document.getElementById('quickTwVolInput');
      const twVal = document.getElementById('taiwaneseVolVal');
      const qTwVal = document.getElementById('quickTwVolVal');
      const pct = `${Math.round(cfg.taiwaneseVolume * 100)}%`;
      if (twInput) twInput.value = cfg.taiwaneseVolume;
      if (qTwInput) qTwInput.value = cfg.taiwaneseVolume;
      if (twVal) twVal.textContent = pct;
      if (qTwVal) qTwVal.textContent = pct;
    }

    // 4. 國語音量
    if (typeof cfg.mandarinVolume === 'number') {
      this.audioEngine.setMandarinVolume(cfg.mandarinVolume);
      const zhInput = document.getElementById('speechVolInput');
      const qZhInput = document.getElementById('quickZhVolInput');
      const zhVal = document.getElementById('speechVolVal');
      const qZhVal = document.getElementById('quickZhVolVal');
      const pct = `${Math.round(cfg.mandarinVolume * 100)}%`;
      if (zhInput) zhInput.value = cfg.mandarinVolume;
      if (qZhInput) qZhInput.value = cfg.mandarinVolume;
      if (zhVal) zhVal.textContent = pct;
      if (qZhVal) qZhVal.textContent = pct;
    }

    // 5. 輕音樂風格與音量
    if (cfg.musicStyle) {
      this.audioEngine.musicStyle = cfg.musicStyle;
      const styleSel = document.getElementById('musicStyleSelect');
      if (styleSel) styleSel.value = cfg.musicStyle;
    }
    if (typeof cfg.musicVolume === 'number') {
      this.audioEngine.setMusicVolume(cfg.musicVolume);
      const mVolInput = document.getElementById('musicVolInput');
      const mVolVal = document.getElementById('musicVolVal');
      if (mVolInput) mVolInput.value = cfg.musicVolume;
      if (mVolVal) mVolVal.textContent = `${Math.round(cfg.musicVolume * 100)}%`;
    }

    // 6. 各階段倒數時間
    if (cfg.durations && typeof cfg.durations === 'object') {
      this.customDurations = { ...this.customDurations, ...cfg.durations };
      const durationMap = [
        { id: 'durSupineRest', key: 'supine_rest' },
        { id: 'durSitting', key: 'sitting_transition' },
        { id: 'durStand1', key: 'stand_1min' },
        { id: 'durStand3', key: 'stand_3min' }
      ];
      durationMap.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (el && typeof this.customDurations[key] === 'number') {
          el.value = this.customDurations[key];
        }
      });
      const step = this.getCurrentStep();
      if (step && !this.timerRunning) {
        this.timerTotalSec = this.getStepDurationSec(step);
        this.timerRemainingSec = this.timerTotalSec;
        this._updateTimerUI();
      }
    }

    // 7. 坐姿過渡階段開關
    if (typeof cfg.includeSittingStep === 'boolean') {
      this.includeSittingStep = cfg.includeSittingStep;
      const sittingToggle = document.getElementById('includeSittingToggle');
      if (sittingToggle) sittingToggle.checked = cfg.includeSittingStep;
      this._renderStepper();
      this._renderMeasurementStages();
      this._updateClinicalAssessment();
    }

    // 8. 快速測試模式開關
    if (typeof cfg.quickDemoMode === 'boolean') {
      this.quickDemoMode = cfg.quickDemoMode;
      const demoToggle = document.getElementById('quickDemoToggle');
      if (demoToggle) demoToggle.checked = cfg.quickDemoMode;
      const step = this.getCurrentStep();
      if (step && !this.timerRunning) {
        this.timerTotalSec = this.getStepDurationSec(step);
        this.timerRemainingSec = this.timerTotalSec;
        this._updateTimerUI();
      }
    }
  }

  _getFilteredHistoryRecords() {
    const allRecords = window.OHStorageManager.getAllRecords();
    const query = (document.getElementById('historySearchInput')?.value || '').trim().toLowerCase();
    return allRecords.filter(r => {
      if (!query) return true;
      const name = (r.patient?.name || '').toLowerCase();
      const chartId = (r.patient?.chartId || '').toLowerCase();
      return name.includes(query) || chartId.includes(query);
    });
  }

  _updateHistorySelectionUI(filteredRecords = null) {
    const filtered = filteredRecords || this._getFilteredHistoryRecords();
    const selectAllCheckbox = document.getElementById('historySelectAllCheckbox');
    const selectAllBtn = document.getElementById('historySelectAllBtn');
    const exportSelectedBtn = document.getElementById('historyExportSelectedCsvBtn');

    const visibleSelectedCount = filtered.filter(r => this.selectedHistoryIds.has(r.id)).length;
    const totalSelectedCount = this.selectedHistoryIds.size;

    if (selectAllCheckbox) {
      if (filtered.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.disabled = true;
      } else {
        selectAllCheckbox.disabled = false;
        selectAllCheckbox.checked = visibleSelectedCount === filtered.length;
        selectAllCheckbox.indeterminate = visibleSelectedCount > 0 && visibleSelectedCount < filtered.length;
      }
    }

    if (selectAllBtn) {
      const allVisibleSelected = filtered.length > 0 && visibleSelectedCount === filtered.length;
      selectAllBtn.textContent = allVisibleSelected ? '☐ 取消全選' : '☑️ 全選';
    }

    if (exportSelectedBtn) {
      exportSelectedBtn.textContent = `📊 匯出已勾選 CSV (${totalSelectedCount})`;
    }
  }

  _bindHistoryControls() {
    const searchInput = document.getElementById('historySearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this._refreshHistoryTable();
      });
    }

    const toggleSelectAll = (forceSelect) => {
      const filtered = this._getFilteredHistoryRecords();
      if (filtered.length === 0) {
        this.showToast('目前尚無可選取的歷史紀錄');
        return;
      }
      const shouldSelect = typeof forceSelect === 'boolean'
        ? forceSelect
        : !filtered.every(r => this.selectedHistoryIds.has(r.id));

      filtered.forEach(r => {
        if (shouldSelect) {
          this.selectedHistoryIds.add(r.id);
        } else {
          this.selectedHistoryIds.delete(r.id);
        }
      });

      document.querySelectorAll('.history-row-checkbox').forEach(cb => {
        cb.checked = this.selectedHistoryIds.has(cb.dataset.recordId);
      });
      this._updateHistorySelectionUI(filtered);
    };

    const selectAllCheckbox = document.getElementById('historySelectAllCheckbox');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        toggleSelectAll(e.target.checked);
      });
    }

    const selectAllBtn = document.getElementById('historySelectAllBtn');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        toggleSelectAll();
      });
    }

    const exportSelectedBtn = document.getElementById('historyExportSelectedCsvBtn');
    if (exportSelectedBtn) {
      exportSelectedBtn.addEventListener('click', () => {
        const allRecords = window.OHStorageManager.getAllRecords();
        const selectedRecords = allRecords.filter(r => this.selectedHistoryIds.has(r.id));
        if (selectedRecords.length === 0) {
          this.showToast('請先勾選至少一筆歷史紀錄再匯出 CSV');
          return;
        }
        window.OHStorageManager.exportRecordsToCSV(selectedRecords);
        this.showToast(`📊 已匯出已勾選的 ${selectedRecords.length} 筆歷史紀錄 CSV`);
      });
    }

    const exportAllBtn = document.getElementById('historyExportCsvBtn');
    if (exportAllBtn) {
      exportAllBtn.addEventListener('click', () => {
        const records = window.OHStorageManager.getAllRecords();
        if (records.length === 0) {
          this.showToast('目前尚無已儲存的歷史紀錄可匯出');
          return;
        }
        window.OHStorageManager.exportRecordsToCSV(records);
        this.showToast(`📊 已匯出全部 ${records.length} 筆歷史紀錄 CSV`);
      });
    }
  }

  _refreshHistoryTable() {
    const allRecords = window.OHStorageManager.getAllRecords();
    const validIds = new Set(allRecords.map(r => r.id));
    for (const id of this.selectedHistoryIds) {
      if (!validIds.has(id)) {
        this.selectedHistoryIds.delete(id);
      }
    }

    const countBadge = document.getElementById('historyCountBadge');
    if (countBadge) countBadge.textContent = String(allRecords.length);

    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    const filtered = this._getFilteredHistoryRecords();
    tbody.innerHTML = '';

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center; padding: 2rem; color: #64748b;">
            尚無符合條件的儲存紀錄。在主畫面完成測量後點擊「💾 儲存本次紀錄」即可在此查詢與匯出。
          </td>
        </tr>
      `;
      this._updateHistorySelectionUI(filtered);
      return;
    }

    filtered.forEach(rec => {
      const p = rec.patient || {};
      const m = rec.measurements || {};
      const evalRes = window.OHClinicalEvaluator.evaluateRecord(rec);

      const tagClass =
        evalRes.status === 'positive'
          ? 'tag-positive'
          : evalRes.status === 'symptomatic_borderline'
          ? 'tag-borderline'
          : 'tag-normal';

      const isChecked = this.selectedHistoryIds.has(rec.id);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="history-check-col">
          <input type="checkbox" class="history-checkbox history-row-checkbox" data-record-id="${rec.id}" aria-label="選取病患 ${p.name || p.chartId || '未命名'} 紀錄" ${isChecked ? 'checked' : ''} />
        </td>
        <td>${rec.measuredAt || '-'}</td>
        <td><strong>${p.chartId || '-'}</strong></td>
        <td>${p.name || '-'}${p.age ? ` (${p.age}歲)` : ''}</td>
        <td>${m.supine?.sbp || '--'}/${m.supine?.dbp || '--'} <small>(${m.supine?.hr || '--'})</small></td>
        <td>${m.stand1?.sbp || '--'}/${m.stand1?.dbp || '--'} <small>(Δ${evalRes.stand1Eval?.deltaSbp ?? '--'})</small></td>
        <td>${m.stand3?.sbp || '--'}/${m.stand3?.dbp || '--'} <small>(Δ${evalRes.stand3Eval?.deltaSbp ?? '--'})</small></td>
        <td><span class="status-tag ${tagClass}">${evalRes.isPositiveOH ? '陽性 (OH+)' : '陰性 (OH-)'}</span></td>
        <td>
          <button type="button" class="speak-single-btn load-rec-btn">載入檢視</button>
          <button type="button" class="speak-single-btn del-rec-btn" style="color:#dc2626;">刪除</button>
        </td>
      `;

      const rowCheckbox = tr.querySelector('.history-row-checkbox');
      if (rowCheckbox) {
        rowCheckbox.addEventListener('change', (e) => {
          if (e.target.checked) {
            this.selectedHistoryIds.add(rec.id);
          } else {
            this.selectedHistoryIds.delete(rec.id);
          }
          this._updateHistorySelectionUI(filtered);
        });
      }

      tr.querySelector('.load-rec-btn').addEventListener('click', () => {
        this.currentRecord = JSON.parse(JSON.stringify(rec));
        this._syncPatientFormFromModel();
        this._renderMeasurementStages();
        this._updateClinicalAssessment();
        document.querySelector('[data-tab="tab-workspace"]')?.click();
        this.showToast(`📂 已載入病患「${p.name || p.chartId || '未命名'}」的測量紀錄`);
      });

      tr.querySelector('.del-rec-btn').addEventListener('click', async () => {
        const confirmed = await this.showConfirmDialog({
          title: '確認刪除紀錄',
          message: `確定要刪除病患「${p.name || p.chartId || '未命名'}」（${rec.measuredAt || '-'}）的測量紀錄嗎？刪除後無法復原。`,
          confirmText: '確定刪除',
          cancelText: '取消',
          isDestructive: true
        });
        if (!confirmed) return;

        this.selectedHistoryIds.delete(rec.id);
        window.OHStorageManager.deleteRecord(rec.id);
        this._refreshHistoryTable();
        this.showToast('🗑️ 已刪除該筆紀錄');
      });

      tbody.appendChild(tr);
    });

    this._updateHistorySelectionUI(filtered);
  }

  _copyTextToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).catch(() => {
        this._fallbackCopyText(text);
      });
      return;
    }
    this._fallbackCopyText(text);
  }

  _fallbackCopyText(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
    } catch (e) {
      // 忽略瀏覽器不支援時的錯誤
    }
    document.body.removeChild(ta);
  }

  showConfirmDialog({
    title = '確認操作',
    message = '確定要執行此操作嗎？',
    confirmText = '確定',
    cancelText = '取消',
    isDestructive = false
  } = {}) {
    const backdrop = document.getElementById('confirmModalBackdrop');
    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMessage');
    const confirmBtn = document.getElementById('confirmModalConfirmBtn');
    const cancelBtn = document.getElementById('confirmModalCancelBtn');

    if (!backdrop || !confirmBtn || !cancelBtn) {
      return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    }

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    confirmBtn.classList.toggle('destructive', Boolean(isDestructive));

    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');

    return new Promise((resolve) => {
      const cleanup = (result) => {
        backdrop.classList.remove('open');
        backdrop.setAttribute('aria-hidden', 'true');
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
        backdrop.removeEventListener('click', onBackdropClick);
        document.removeEventListener('keydown', onKeyDown);
        resolve(result);
      };

      const onConfirm = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onBackdropClick = (e) => {
        if (e.target === backdrop) cleanup(false);
      };
      const onKeyDown = (e) => {
        if (e.key === 'Escape') cleanup(false);
      };

      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
      backdrop.addEventListener('click', onBackdropClick);
      document.addEventListener('keydown', onKeyDown);
    });
  }

  showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3400);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.ohApp = new OHAppController();
});
