/**
 * 台灣本土雙語（台灣國語 zh-TW + 台灣台語 Taiwanese Hokkien）語音提示引擎與舒緩輕音樂系統
 * 支援：
 * 1. 「台語音量 (支援 Web Audio GainNode 最高 3.5 倍硬體增幅放大)」與「國語音量」完全獨立調整
 * 2. 四種臨床語音搭配模式：
 *    - 'patient_tw_staff_zh' (預設推薦：對病患講台語、對醫護人員講國語)
 *    - 'all_tw'              (全台語模式：對病患與醫護人員皆講台語)
 *    - 'patient_both_staff_zh' (國台雙聲道：對病患先講國語再講台語、對醫護講國語)
 *    - 'all_zh'              (台灣國語模式：全部講台灣國語)
 * 3. Web Audio API 即時生成療癒輕音樂 + 自訂外部 MP3 音樂
 * 4. 語音說話時背景輕音樂自動淡出閃避 (Auto-ducking)
 */

// 全系統 43 支預合成台語與台灣國語語音檔標準秒數字典（依實體 MP3 幀精準解碼秒數，供進度條即時精密運算）
const AUDIO_DURATIONS = {
  'audio/taiwanese/complete_patient.mp3': 8.42,
  'audio/taiwanese/complete_staff.mp3': 9.97,
  'audio/taiwanese/emergency_abort.mp3': 13.46,
  'audio/taiwanese/pre_alert.mp3': 8.21,
  'audio/taiwanese/prep_patient.mp3': 11.56,
  'audio/taiwanese/prep_staff.mp3': 10.33,
  'audio/taiwanese/sitting_transition_patient.mp3': 13.25,
  'audio/taiwanese/sitting_transition_staff.mp3': 9.72,
  'audio/taiwanese/stand_1min_patient.mp3': 17.60,
  'audio/taiwanese/stand_1min_staff.mp3': 10.66,
  'audio/taiwanese/stand_3min_patient.mp3': 14.33,
  'audio/taiwanese/stand_3min_staff.mp3': 9.65,
  'audio/taiwanese/supine_measure_patient.mp3': 8.75,
  'audio/taiwanese/supine_measure_staff.mp3': 10.48,
  'audio/taiwanese/supine_rest_patient.mp3': 11.92,
  'audio/taiwanese/supine_rest_staff.mp3': 10.80,
  'audio/taiwanese/test_voice.mp3': 12.17,
  'audio/taiwanese/timer_done.mp3': 11.70,

  'audio/mandarin/complete_patient.mp3': 13.32,
  'audio/mandarin/complete_staff.mp3': 18.67,
  'audio/mandarin/emergency_abort.mp3': 17.98,
  'audio/mandarin/prep_patient.mp3': 18.84,
  'audio/mandarin/prep_staff.mp3': 14.95,
  'audio/mandarin/sitting_transition_patient.mp3': 15.38,
  'audio/mandarin/sitting_transition_pre_alert.mp3': 14.30,
  'audio/mandarin/sitting_transition_staff.mp3': 11.52,
  'audio/mandarin/sitting_transition_timer_done.mp3': 10.63,
  'audio/mandarin/stand_1min_patient.mp3': 19.99,
  'audio/mandarin/stand_1min_pre_alert.mp3': 14.30,
  'audio/mandarin/stand_1min_staff.mp3': 16.30,
  'audio/mandarin/stand_1min_timer_done.mp3': 17.14,
  'audio/mandarin/stand_3min_patient.mp3': 19.70,
  'audio/mandarin/stand_3min_pre_alert.mp3': 12.74,
  'audio/mandarin/stand_3min_staff.mp3': 16.63,
  'audio/mandarin/stand_3min_timer_done.mp3': 13.56,
  'audio/mandarin/supine_measure_patient.mp3': 15.74,
  'audio/mandarin/supine_measure_staff.mp3': 15.65,
  'audio/mandarin/supine_rest_patient.mp3': 16.92,
  'audio/mandarin/supine_rest_pre_alert.mp3': 12.36,
  'audio/mandarin/supine_rest_staff.mp3': 12.53,
  'audio/mandarin/supine_rest_timer_done.mp3': 12.05,
  'audio/mandarin/test_voice_patient.mp3': 8.93,
  'audio/mandarin/test_voice_staff.mp3': 10.80
};
Object.freeze(AUDIO_DURATIONS);

class OHAudioEngine {
  constructor() {
    this.audioCtx = null;
    this.speechEnabled = true;

    // 獨立音量控制：國語預設 0.65 (65%) 避免過大聲，台語預設 2.20 (220% 增幅放大) 補足原音檔響度
    // 兩者皆透過 Web Audio API 專屬 GainNode 即時控制，拖曳滑桿時即使在播報中也會立即改變音量
    this.mandarinVolume = 0.65;   // 範圍 0.0 ~ 2.0 (0% 靜音 ~ 200% 增幅)
    this.taiwaneseVolume = 2.20;  // 範圍 0.0 ~ 4.0 (0% 靜音 ~ 400% 增幅)

    this.speechRate = 0.96;
    this.languageMode = 'patient_tw_staff_zh';
    this.selectedVoiceURI = null;
    this.availableTwVoices = [];
    this.allVoices = [];
    this.isSpeaking = false;

    // 國語與台語各自獨立的 Web Audio 增幅節點與防破音動態壓縮器
    this.mandarinGainNode = null;
    this.taiwaneseGainNode = null;
    this.taiwaneseCompressor = null;

    // 輕音樂控制狀態
    this.musicEnabled = true;
    this.musicVolume = 0.40;
    this.duckingRatio = 0.15; // 語音播報時，輕音樂降至原音量的 15%
    this.musicStyle = 'piano_pad';
    this.isMusicPlaying = false;
    this.musicTimerId = null;
    this.masterMusicGain = null;
    this.customMusicAudio = null;
    this.customMusicObjectUrl = null;

    // 各階段自訂語音檔案 Map: stepId -> Audio objectUrl
    this.customStepVoiceUrls = {};
    this.currentVoiceAudio = null;

    // 事件回呼
    this.onSpeakingStatusChange = null;
    this.onMusicStatusChange = null;
    this.onVoicesLoaded = null;
    this.onVoiceProgress = null; // 語音播放進度即時回呼 ({ active, percent, elapsedSec, totalSec, roleLabel, stepId, completed })

    // 語音播放進度追蹤內部狀態（採用全域單調平滑時鐘，徹底消除跳躍與異常）
    this._currentStepId = null;
    this._voiceQueue = [];
    this._voiceQueueIndex = -1;
    this._progressTicker = null;
    this._totalVoiceDuration = 0;
    this._timelineItems = [];
    this._currentRoleLabel = '';
    this._masterStartTime = 0;
    this._masterPausedOffset = 0;
    this._isVoicePaused = false;
    this._chimeTimeoutId = null;
    this._nextItemTimeoutId = null;
    this._audioBufferCache = new Map();

    this._initSpeechVoices();
  }

  /**
   * 確保 Web Audio API Context、輕音樂 GainNode 以及「台語音量放大器 (Gain + Compressor)」已初始化
   */
  ensureAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();

      // 1. 輕音樂主音量節點
      this.masterMusicGain = this.audioCtx.createGain();
      this.masterMusicGain.gain.setValueAtTime(this.musicVolume, this.audioCtx.currentTime);
      this.masterMusicGain.connect(this.audioCtx.destination);

      // 2. 語音防破音動態壓縮器 + 台語與國語各自獨立的 GainNode
      // 徹底解決瀏覽器內建 SpeechSynthesisUtterance.volume 無法即時調整或被系統語音忽略的問題
      this.taiwaneseCompressor = this.audioCtx.createDynamicsCompressor();
      this.taiwaneseCompressor.threshold.setValueAtTime(-14, this.audioCtx.currentTime);
      this.taiwaneseCompressor.knee.setValueAtTime(18, this.audioCtx.currentTime);
      this.taiwaneseCompressor.ratio.setValueAtTime(4, this.audioCtx.currentTime);
      this.taiwaneseCompressor.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
      this.taiwaneseCompressor.release.setValueAtTime(0.20, this.audioCtx.currentTime);
      this.taiwaneseCompressor.connect(this.audioCtx.destination);

      this.taiwaneseGainNode = this.audioCtx.createGain();
      this.taiwaneseGainNode.gain.setValueAtTime(this.taiwaneseVolume, this.audioCtx.currentTime);
      this.taiwaneseGainNode.connect(this.taiwaneseCompressor);

      this.mandarinGainNode = this.audioCtx.createGain();
      this.mandarinGainNode.gain.setValueAtTime(this.mandarinVolume, this.audioCtx.currentTime);
      this.mandarinGainNode.connect(this.taiwaneseCompressor);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * 設定國語語音音量 (0.0 ~ 2.0，透過 Web Audio GainNode 即時生效，播報中拖曳滑桿亦立即改變音量)
   */
  setMandarinVolume(vol) {
    const parsed = parseFloat(vol);
    this.mandarinVolume = Math.max(0, Math.min(2.0, Number.isNaN(parsed) ? 0.65 : parsed));
    if (this.audioCtx && this.mandarinGainNode) {
      this.mandarinGainNode.gain.setValueAtTime(this.mandarinVolume, this.audioCtx.currentTime);
    }
    if (this.currentVoiceAudio && this._currentAudioLang === 'zh' && !this._currentAudioConnectedToWebAudio) {
      this.currentVoiceAudio.volume = Math.min(1.0, this.mandarinVolume);
    }
  }

  /**
   * 設定台語語音音量 (0.0 ~ 4.0，支援最高 400% 增幅放大)
   */
  setTaiwaneseVolume(vol) {
    const parsed = parseFloat(vol);
    this.taiwaneseVolume = Math.max(0, Math.min(4.0, Number.isNaN(parsed) ? 2.2 : parsed));
    if (this.audioCtx && this.taiwaneseGainNode) {
      this.taiwaneseGainNode.gain.setValueAtTime(this.taiwaneseVolume, this.audioCtx.currentTime);
    }
    if (this.currentVoiceAudio && this._currentAudioLang !== 'zh' && !this._currentAudioConnectedToWebAudio) {
      this.currentVoiceAudio.volume = Math.min(1.0, this.taiwaneseVolume);
    }
  }

  /**
   * 初始化並嚴格篩選台灣本土中文 (zh-TW) 語音
   */
  _initSpeechVoices() {
    if (!('speechSynthesis' in window)) {
      console.warn('此瀏覽器不支援 Web Speech API');
      return;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      if (voices.length === 0) return;

      this.allVoices = voices;

      const twVoices = voices.filter(v => {
        const lang = (v.lang || '').replace('_', '-').toLowerCase();
        const name = (v.name || '').toLowerCase();
        return (
          lang === 'zh-tw' ||
          lang.startsWith('zh-tw') ||
          lang === 'cmn-hant-tw' ||
          name.includes('taiwan') ||
          name.includes('臺灣') ||
          name.includes('台灣') ||
          name.includes('hsiaochen') ||
          name.includes('hsiaoyu') ||
          name.includes('yunjhe') ||
          name.includes('yating') ||
          name.includes('hanhan') ||
          name.includes('zhiwei') ||
          name.includes('meijia')
        );
      });

      twVoices.sort((a, b) => {
        const score = (v) => {
          const n = v.name.toLowerCase();
          let s = 0;
          if (n.includes('natural') || n.includes('online')) s += 50;
          if (n.includes('hsiaochen') || n.includes('曉臻')) s += 40;
          if (n.includes('hsiaoyu') || n.includes('曉雨')) s += 35;
          if (n.includes('yunjhe') || n.includes('雲哲')) s += 30;
          if (n.includes('meijia') || n.includes('美佳')) s += 28;
          if (n.includes('yating') || n.includes('hanhan')) s += 25;
          if (n.includes('google') && (n.includes('臺灣') || n.includes('taiwan'))) s += 22;
          if (v.default) s += 5;
          return s;
        };
        return score(b) - score(a);
      });

      this.availableTwVoices = twVoices;

      if (!this.selectedVoiceURI && twVoices.length > 0) {
        this.selectedVoiceURI = twVoices[0].voiceURI;
      }

      if (typeof this.onVoicesLoaded === 'function') {
        this.onVoicesLoaded(this.availableTwVoices, this.selectedVoiceURI);
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  getSelectedVoice() {
    if (!this.availableTwVoices.length) {
      return this.allVoices.find(v => (v.lang || '').replace('_', '-').toLowerCase().includes('zh-tw')) || null;
    }
    return (
      this.availableTwVoices.find(v => v.voiceURI === this.selectedVoiceURI) ||
      this.availableTwVoices[0]
    );
  }

  /**
   * 播放溫和的醫療提示音 (叮咚雙音 Chime)
   */
  playChime(type = 'normal') {
    this.ensureAudioContext();
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const chimeVol = Math.max(0.3, Math.min(1.0, this.mandarinVolume));

    const playTone = (freq, startTime, duration, peakGain = 0.16) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(peakGain * chimeVol, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    if (type === 'alert') {
      playTone(783.99, now, 0.35, 0.20);
      playTone(987.77, now + 0.16, 0.45, 0.20);
      playTone(1174.66, now + 0.32, 0.65, 0.22);
    } else if (type === 'done') {
      playTone(523.25, now, 0.45, 0.20);
      playTone(783.99, now + 0.18, 0.55, 0.20);
      playTone(1046.50, now + 0.36, 0.85, 0.22);
    } else {
      playTone(659.25, now, 0.45, 0.14);
      playTone(880.00, now + 0.20, 0.70, 0.16);
    }
  }

  /**
   * 智慧音量閃避 (Auto-ducking)：當播放語音時降低背景輕音樂音量
   */
  _setMusicDucking(isDucked) {
    const targetVol = isDucked
      ? this.musicVolume * this.duckingRatio
      : this.musicVolume;

    if (this.audioCtx && this.masterMusicGain) {
      const now = this.audioCtx.currentTime;
      this.masterMusicGain.gain.cancelScheduledValues(now);
      this.masterMusicGain.gain.setValueAtTime(this.masterMusicGain.gain.value, now);
      this.masterMusicGain.gain.linearRampToValueAtTime(
        this.musicEnabled ? targetVol : 0.0001,
        now + (isDucked ? 0.25 : 0.85)
      );
    }

    if (this.customMusicAudio) {
      this.customMusicAudio.volume = this.musicEnabled ? Math.min(1, Math.max(0, targetVol)) : 0;
    }
  }

  /**
   * 根據目前語音模式與語速，動態計算特定步驟的語音預估總時長（秒）
   */
  getEstimatedDurationForStep(step) {
    if (!step) return 0;
    const mode = this.languageMode || 'patient_tw_staff_zh';
    const rate = this.speechRate || 0.96;
    const intervalGap = 0.42;
    const urls = [];

    // 1. 病患語音
    if (mode === 'patient_tw_staff_zh' || mode === 'all_tw') {
      if (step.taiwaneseAudio && step.taiwaneseAudio.patient) {
        urls.push(step.taiwaneseAudio.patient);
      }
    } else if (mode === 'patient_both_staff_zh') {
      if (step.mandarinAudio && step.mandarinAudio.patient) {
        urls.push(step.mandarinAudio.patient);
      }
      if (step.taiwaneseAudio && step.taiwaneseAudio.patient) {
        urls.push(step.taiwaneseAudio.patient);
      }
    } else { // all_zh
      if (step.mandarinAudio && step.mandarinAudio.patient) {
        urls.push(step.mandarinAudio.patient);
      }
    }

    // 2. 醫護語音
    if (mode === 'all_tw') {
      if (step.taiwaneseAudio && step.taiwaneseAudio.staff) {
        urls.push(step.taiwaneseAudio.staff);
      }
    } else {
      if (step.mandarinAudio && step.mandarinAudio.staff) {
        urls.push(step.mandarinAudio.staff);
      }
    }

    if (urls.length === 0) return 0;

    let total = 0;
    urls.forEach((url, idx) => {
      const baseSec = AUDIO_DURATIONS[url] || 12.0;
      total += baseSec / rate;
      if (idx < urls.length - 1) {
        total += intervalGap;
      }
    });

    return Math.max(1, Math.round(total));
  }

  /**
   * 播報雙角色語音提示（國語與台語皆支援透過 Web Audio API 專屬 GainNode 精準獨立控音）
   */
  speakPrompt({
    stepId = null,
    patientText = '',
    staffText = '',
    patientTwAudioUrl = '',
    staffTwAudioUrl = '',
    patientZhAudioUrl = '',
    staffZhAudioUrl = '',
    singleText = '',
    singleTwAudioUrl = '',
    singleZhAudioUrl = '',
    chimeType = 'normal',
    roleFilter = 'both',
    forceLang = null
  }) {
    this.stopSpeech();

    if (!this.speechEnabled) {
      return;
    }

    const token = this._voicePlayToken;
    this._setSpeakingState(true);
    this._setMusicDucking(true);
    if (chimeType && chimeType !== 'none') {
      this.playChime(chimeType);
    }

    if (stepId && this.customStepVoiceUrls[stepId] && !singleText && !forceLang) {
      setTimeout(() => {
        if (!this.isSpeaking || this._voicePlayToken !== token) return;
        this._playQueue([{ type: 'audio', lang: 'tw', url: this.customStepVoiceUrls[stepId] }], 0, token);
      }, 480);
      return;
    }

    const queue = [];
    const mode = this.languageMode;

    const pushZhItem = (zhUrl, text, pitch = 1.0, rate = this.speechRate, role = 'staff', roleLabel = '醫護說明 (國語)') => {
      if (zhUrl) {
        queue.push({ type: 'audio', lang: 'zh', url: zhUrl, fallbackText: text, role, roleLabel });
      } else if (text) {
        queue.push({ type: 'tts', lang: 'zh', text, pitch, rate, role, roleLabel });
      }
    };

    const pushTwItem = (twUrl, fallbackText, role = 'patient', roleLabel = '病患指引 (台語)') => {
      if (twUrl) {
        queue.push({ type: 'audio', lang: 'tw', url: twUrl, fallbackText, role, roleLabel });
      } else if (fallbackText) {
        queue.push({ type: 'tts', lang: 'zh', text: fallbackText, pitch: 1.0, rate: this.speechRate, role, roleLabel });
      }
    };

    if (singleText || singleTwAudioUrl || singleZhAudioUrl) {
      const useTw =
        forceLang === 'tw' ||
        (forceLang !== 'zh' && mode === 'all_tw');

      if (useTw && singleTwAudioUrl) {
        pushTwItem(singleTwAudioUrl, singleText, 'single', '語音提示 (台語)');
      } else {
        pushZhItem(singleZhAudioUrl, singleText, 1.0, this.speechRate, 'single', '語音提示 (國語)');
      }
    } else {
      // 1. 對病患的語音提示
      if (roleFilter === 'both' || roleFilter === 'patient') {
        const patientSpokenZh = patientText ? `病患請注意：${patientText}` : '';
        if (forceLang === 'tw') {
          pushTwItem(patientTwAudioUrl, patientSpokenZh, 'patient', '病患指引 (台語)');
        } else if (forceLang === 'zh') {
          pushZhItem(patientZhAudioUrl, patientSpokenZh, 1.04, Math.max(0.82, this.speechRate - 0.04), 'patient', '病患指引 (國語)');
        } else if (mode === 'patient_tw_staff_zh' || mode === 'all_tw') {
          if (patientTwAudioUrl) {
            pushTwItem(patientTwAudioUrl, patientSpokenZh, 'patient', '病患指引 (台語)');
          } else {
            pushZhItem(patientZhAudioUrl, patientSpokenZh, 1.04, this.speechRate, 'patient', '病患指引 (國語)');
          }
        } else if (mode === 'patient_both_staff_zh') {
          pushZhItem(patientZhAudioUrl, patientSpokenZh, 1.04, Math.max(0.82, this.speechRate - 0.04), 'patient', '病患指引 (國語)');
          if (patientTwAudioUrl) {
            pushTwItem(patientTwAudioUrl, '', 'patient', '病患指引 (台語)');
          }
        } else {
          pushZhItem(patientZhAudioUrl, patientSpokenZh, 1.04, Math.max(0.82, this.speechRate - 0.04), 'patient', '病患指引 (國語)');
        }
      }

      // 2. 對醫護人員的語音提示
      if (roleFilter === 'both' || roleFilter === 'staff') {
        if (forceLang === 'tw') {
          pushTwItem(staffTwAudioUrl, staffText, 'staff', '醫護說明 (台語)');
        } else if (forceLang === 'zh') {
          pushZhItem(staffZhAudioUrl, staffText, 0.98, this.speechRate, 'staff', '醫護說明 (國語)');
        } else if (mode === 'all_tw' && staffTwAudioUrl) {
          pushTwItem(staffTwAudioUrl, staffText, 'staff', '醫護說明 (台語)');
        } else {
          pushZhItem(staffZhAudioUrl, staffText, 0.98, this.speechRate, 'staff', '醫護說明 (國語)');
        }
      }
    }

    if (queue.length === 0) {
      this._stopVoiceProgressTicker();
      this._emitVoiceProgress({
        active: false,
        percent: 0,
        elapsedSec: 0,
        totalSec: 0,
        roleLabel: '',
        stepId,
        completed: false
      });
      this._setSpeakingState(false);
      this._setMusicDucking(false);
      return;
    }

    // 計算整個佇列的預估總時長與各項目的精準時間區間 (包含項目間隔 0.42 秒)
    const intervalGap = 0.42;
    let cumulativeTime = 0;
    const timelineItems = [];

    queue.forEach((it, idx) => {
      // 優先使用精確標準秒數字典，音檔項目切勿因未即時解碼而回退至長文字列 TTS 預估
      let itemSec = 0;
      if (it.url && AUDIO_DURATIONS[it.url]) {
        itemSec = AUDIO_DURATIONS[it.url];
      } else if (it.type === 'audio') {
        itemSec = it.role === 'patient' ? 12.0 : 15.0;
      } else if (it.text) {
        itemSec = it.text.length / 3.6;
      } else {
        itemSec = 5.0;
      }
      it.duration = itemSec / (this.speechRate || 1.0);
      const startTime = cumulativeTime;
      const endTime = startTime + it.duration;
      timelineItems.push({
        index: idx,
        roleLabel: it.roleLabel,
        startTime,
        endTime,
        duration: it.duration
      });
      cumulativeTime = endTime + (idx < queue.length - 1 ? intervalGap : 0);
    });

    this._currentStepId = stepId;
    this._voiceQueue = queue;
    this._voiceQueueIndex = 0;
    this._totalVoiceDuration = Math.max(0.8, cumulativeTime);
    this._timelineItems = timelineItems;
    this._currentRoleLabel = queue[0]?.roleLabel || '語音提示準備中...';
    this._masterStartTime = performance.now();
    this._masterPausedOffset = 0;
    this._isVoicePaused = false;

    this._emitVoiceProgress({
      active: true,
      isPaused: false,
      percent: 0,
      elapsedSec: 0,
      totalSec: this._totalVoiceDuration,
      roleLabel: this._currentRoleLabel,
      stepId,
      completed: false
    });

    clearTimeout(this._chimeTimeoutId);
    const delayMs = chimeType === 'none' ? 0 : 520;
    if (delayMs === 0) {
      if (!this.isSpeaking || this._voicePlayToken !== token) return;
      this._masterStartTime = performance.now();
      this._masterPausedOffset = 0;
      this._startVoiceProgressTicker();
      this._playQueue(queue, 0, token);
    } else {
      this._chimeTimeoutId = setTimeout(() => {
        if (!this.isSpeaking || this._voicePlayToken !== token) return;
        this._masterStartTime = performance.now();
        this._masterPausedOffset = 0;
        this._startVoiceProgressTicker();
        this._playQueue(queue, 0, token);
      }, delayMs);
    }
  }

  /**
   * 依序執行混合佇列（台語與國語 MP3 皆透過 Web Audio API 專屬 GainNode 即時控音）
   */
  _playQueue(queue, index, token = null) {
    if (!this.isSpeaking || (token !== null && this._voicePlayToken !== token) || index >= queue.length) {
      if (token !== null && this._voicePlayToken === token && this.isSpeaking) {
        this._stopVoiceProgressTicker();
        this._emitVoiceProgress({
          active: false,
          isPaused: false,
          percent: 100,
          elapsedSec: this._totalVoiceDuration,
          totalSec: this._totalVoiceDuration,
          roleLabel: '播報完畢',
          stepId: this._currentStepId,
          completed: true
        });
        this._setSpeakingState(false);
        this._setMusicDucking(false);
      }
      return;
    }

    const item = queue[index];
    this._voiceQueueIndex = index;
    this._activeVoiceItem = item;
    if (item.roleLabel) {
      this._currentRoleLabel = item.roleLabel;
    }

    const proceedNext = () => {
      if (!this.isSpeaking || (token !== null && this._voicePlayToken !== token)) return;
      if (index + 1 < queue.length) {
        clearTimeout(this._nextItemTimeoutId);
        this._nextItemTimeoutId = setTimeout(() => {
          if (!this.isSpeaking || (token !== null && this._voicePlayToken !== token)) return;
          this._playQueue(queue, index + 1, token);
        }, 420);
      } else {
        this._stopVoiceProgressTicker();
        this._emitVoiceProgress({
          active: false,
          isPaused: false,
          percent: 100,
          elapsedSec: this._totalVoiceDuration,
          totalSec: this._totalVoiceDuration,
          roleLabel: '播報完畢',
          stepId: this._currentStepId,
          completed: true
        });
        this._setSpeakingState(false);
        this._setMusicDucking(false);
      }
    };

    if (item.type === 'audio' && item.url) {
      this._playBoostedVoiceAudio(item.url, item.lang || 'tw', item.fallbackText, proceedNext, token);
    } else if (item.type === 'tts' && item.text) {
      this._speakSingleUtterance(item.text, item.pitch, item.rate, proceedNext, token);
    } else {
      proceedNext();
    }
  }

  /**
   * 使用 Web Audio API 將台語或國語 MP3 解碼並透過各自獨立的 GainNode 控制音量（突破瀏覽器 TTS 限制且支援播報中即時調音量）
   */
  _playBoostedVoiceAudio(url, lang = 'tw', fallbackText = '', onComplete = null, token = null) {
    this.ensureAudioContext();
    const isMandarin = lang === 'zh';
    const targetGainNode = isMandarin ? this.mandarinGainNode : this.taiwaneseGainNode;

    const playAudioBuffer = (audioBuffer) => {
      if (!this.isSpeaking || (token !== null && this._voicePlayToken !== token)) return;
      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = Math.max(0.8, Math.min(1.25, this.speechRate));

      // 計算此音檔的峰值並自動正規化 (Peak Normalization)
      const channelData = audioBuffer.getChannelData(0);
      let maxPeak = 0.01;
      for (let i = 0; i < channelData.length; i += 8) {
        const abs = Math.abs(channelData[i]);
        if (abs > maxPeak) maxPeak = abs;
      }

      // 台語給予 1.35 倍基礎響度補償，國語給予標準 0.95 峰值正規化，再連結至各自的 GainNode
      const normGain = isMandarin
        ? Math.min(2.0, 0.92 / maxPeak)
        : Math.min(4.0, (0.98 / maxPeak) * 1.35);

      const perClipGain = this.audioCtx.createGain();
      perClipGain.gain.setValueAtTime(normGain, this.audioCtx.currentTime);

      if (isMandarin) {
        this.mandarinGainNode.gain.setValueAtTime(this.mandarinVolume, this.audioCtx.currentTime);
      } else {
        this.taiwaneseGainNode.gain.setValueAtTime(this.taiwaneseVolume, this.audioCtx.currentTime);
      }

      source.connect(perClipGain);
      perClipGain.connect(targetGainNode);

      if (this._activeVoiceItem && this._activeVoiceItem.url === url && audioBuffer && audioBuffer.duration > 0) {
        this._activeVoiceItem.duration = audioBuffer.duration / source.playbackRate.value;
      }
      this._currentItemStartTime = (this.audioCtx && this.audioCtx.state === 'running')
        ? this.audioCtx.currentTime
        : performance.now() / 1000;

      this._currentBufferSource = source;
      source.onended = () => {
        if (this._currentBufferSource === source) {
          this._currentBufferSource = null;
        }
        if (!this.isSpeaking || (token !== null && this._voicePlayToken !== token)) return;
        if (onComplete) onComplete();
      };
      source.start(0);
    };

    // 0. 若此音檔已經在記憶體中解碼快取過，直接零延遲播放
    if (this._audioBufferCache && this._audioBufferCache.has(url)) {
      playAudioBuffer(this._audioBufferCache.get(url));
      return;
    }

    const playDecodedBuffer = (arrayBuffer) => {
      if (!this.isSpeaking || (token !== null && this._voicePlayToken !== token)) return;
      this.audioCtx.decodeAudioData(
        arrayBuffer,
        (audioBuffer) => {
          if (!this.isSpeaking || (token !== null && this._voicePlayToken !== token)) return;
          if (this._audioBufferCache) {
            this._audioBufferCache.set(url, audioBuffer);
          }
          playAudioBuffer(audioBuffer);
        },
        () => {
          if (token !== null && this._voicePlayToken !== token) return;
          this._fallbackHtmlAudioPlay(url, lang, fallbackText, onComplete, token);
        }
      );
    };

    // 1. 優先從內嵌 Base64 音訊庫解碼（不受 file:// CORS 限制，百分之百可經由 GainNode 即時控制音量）
    const b64Map = isMandarin
      ? (window.OH_MANDARIN_AUDIO_B64 || {})
      : (window.OH_TAIWANESE_AUDIO_B64 || {});

    if (b64Map[url]) {
      try {
        const binaryStr = window.atob(b64Map[url]);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        playDecodedBuffer(bytes.buffer);
        return;
      } catch (e) {
        console.warn('Base64 音訊解碼失敗，改用 XHR:', e);
      }
    }

    // 2. 若為外部或自訂上傳音檔，使用 XMLHttpRequest 讀取 ArrayBuffer
    const xhr = new XMLHttpRequest();
    this._currentVoiceXhr = xhr;
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';

    xhr.onload = () => {
      if (this._currentVoiceXhr === xhr) {
        this._currentVoiceXhr = null;
      }
      if (token !== null && this._voicePlayToken !== token) return;
      if ((xhr.status === 200 || xhr.status === 0) && xhr.response) {
        playDecodedBuffer(xhr.response);
      } else {
        this._fallbackHtmlAudioPlay(url, lang, fallbackText, onComplete, token);
      }
    };

    xhr.onerror = () => {
      if (this._currentVoiceXhr === xhr) {
        this._currentVoiceXhr = null;
      }
      if (token !== null && this._voicePlayToken !== token) return;
      this._fallbackHtmlAudioPlay(url, lang, fallbackText, onComplete, token);
    };

    xhr.send();
  }

  /**
   * 當瀏覽器因 file:// 安全性限制阻擋 XHR 時，使用 HTML5 Audio + Web Audio MediaElementSource 控制音量
   */
  _fallbackHtmlAudioPlay(url, lang = 'tw', fallbackText = '', onComplete = null, token = null) {
    if (!this.isSpeaking || (token !== null && this._voicePlayToken !== token)) return;
    const isMandarin = lang === 'zh';
    const audio = new Audio(url);
    this.currentVoiceAudio = audio;
    this._currentAudioLang = lang;
    this._currentAudioConnectedToWebAudio = false;
    audio.playbackRate = Math.max(0.8, Math.min(1.25, this.speechRate));

    try {
      this.ensureAudioContext();
      const mediaSource = this.audioCtx.createMediaElementSource(audio);
      if (isMandarin) {
        this.mandarinGainNode.gain.setValueAtTime(this.mandarinVolume, this.audioCtx.currentTime);
        mediaSource.connect(this.mandarinGainNode);
      } else {
        this.taiwaneseGainNode.gain.setValueAtTime(this.taiwaneseVolume * 1.6, this.audioCtx.currentTime);
        mediaSource.connect(this.taiwaneseGainNode);
      }
      audio.volume = 1.0;
      this._currentAudioConnectedToWebAudio = true;
    } catch (e) {
      audio.volume = Math.max(0, Math.min(1.0, isMandarin ? this.mandarinVolume : this.taiwaneseVolume));
    }

    audio.onended = () => {
      if (this.currentVoiceAudio === audio) {
        this.currentVoiceAudio = null;
      }
      if (!this.isSpeaking || (token !== null && this._voicePlayToken !== token)) return;
      if (onComplete) onComplete();
    };

    audio.onerror = () => {
      if (this.currentVoiceAudio === audio) {
        this.currentVoiceAudio = null;
      }
      if (token !== null && this._voicePlayToken !== token) return;
      if (fallbackText) {
        this._speakSingleUtterance(fallbackText, 1.0, this.speechRate, onComplete, token);
      } else if (onComplete) {
        onComplete();
      }
    };

    audio.onplay = () => {
      if (token !== null && this._voicePlayToken !== token) return;
      this._currentItemStartTime = performance.now() / 1000;
    };
    audio.onloadedmetadata = () => {
      if (token !== null && this._voicePlayToken !== token) return;
      if (audio.duration && !Number.isNaN(audio.duration) && audio.duration > 0) {
        if (this._activeVoiceItem && this._activeVoiceItem.url === url) {
          this._activeVoiceItem.duration = audio.duration / audio.playbackRate;
        }
      }
    };

    audio.play().catch(() => {
      if (this.currentVoiceAudio === audio) {
        this.currentVoiceAudio = null;
      }
      if (token !== null && this._voicePlayToken !== token) return;
      if (fallbackText) {
        this._speakSingleUtterance(fallbackText, 1.0, this.speechRate, onComplete, token);
      } else if (onComplete) {
        onComplete();
      }
    });
  }

  _speakSingleUtterance(text, pitch = 1.0, rate = 0.96, onComplete, token = null) {
    if (!('speechSynthesis' in window)) {
      if (onComplete) onComplete();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    this._currentUtterance = utterance;
    utterance.lang = 'zh-TW';
    const voice = this.getSelectedVoice();
    if (voice) {
      utterance.voice = voice;
    }
    // 使用獨立的「國語音量 (mandarinVolume)」，若為 Web Speech API 則安全限制在 0.0 ~ 1.0
    utterance.volume = Math.max(0, Math.min(1.0, this.mandarinVolume));
    utterance.rate = rate || this.speechRate;
    utterance.pitch = pitch || 1.0;

    utterance.onstart = () => {
      if (token !== null && this._voicePlayToken !== token) return;
      this._currentItemStartTime = performance.now() / 1000;
    };
    utterance.onend = () => {
      if (this._currentUtterance === utterance) {
        this._currentUtterance = null;
      }
      if (token !== null && this._voicePlayToken !== token) return;
      if (onComplete) onComplete();
    };
    utterance.onerror = () => {
      if (this._currentUtterance === utterance) {
        this._currentUtterance = null;
      }
      if (token !== null && this._voicePlayToken !== token) return;
      if (onComplete) onComplete();
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * 暫停當前語音播報
   */
  pauseVoice() {
    if (!this.isSpeaking || this._isVoicePaused) return;
    this._isVoicePaused = true;
    this._masterPausedOffset += (performance.now() - this._masterStartTime) / 1000;
    this._stopVoiceProgressTicker();

    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend();
    }
    if (this.currentVoiceAudio && !this.currentVoiceAudio.paused) {
      this.currentVoiceAudio.pause();
    }
    if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
    }

    const clamped = Math.max(0, Math.min(this._totalVoiceDuration, this._masterPausedOffset));
    const percent = Math.min(99.5, Math.max(0, (clamped / this._totalVoiceDuration) * 100));

    this._emitVoiceProgress({
      active: true,
      isPaused: true,
      percent,
      elapsedSec: clamped,
      totalSec: this._totalVoiceDuration,
      roleLabel: this._currentRoleLabel ? `${this._currentRoleLabel} (已暫停)` : '語音已暫停',
      stepId: this._currentStepId,
      completed: false
    });
  }

  /**
   * 繼續當前語音播報
   */
  resumeVoice() {
    if (!this.isSpeaking || !this._isVoicePaused) return;
    this._isVoicePaused = false;
    this._masterStartTime = performance.now();

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    if (this.currentVoiceAudio && this.currentVoiceAudio.paused) {
      this.currentVoiceAudio.play().catch(() => {});
    }
    if ('speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    this._startVoiceProgressTicker();
  }

  /**
   * 立即停止目前正在播報的國語或台語語音
   */
  stopSpeech() {
    this._voicePlayToken = (this._voicePlayToken || 0) + 1;
    clearTimeout(this._chimeTimeoutId);
    clearTimeout(this._nextItemTimeoutId);
    this._stopVoiceProgressTicker();
    this._isVoicePaused = false;
    this._masterPausedOffset = 0;

    if (this._currentVoiceXhr) {
      try {
        this._currentVoiceXhr.abort();
      } catch (e) {}
      this._currentVoiceXhr = null;
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    if (this._currentUtterance) {
      this._currentUtterance.onend = null;
      this._currentUtterance.onerror = null;
      this._currentUtterance.onstart = null;
      this._currentUtterance = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this._currentBufferSource) {
      try {
        this._currentBufferSource.onended = null;
        this._currentBufferSource.stop();
      } catch (e) {}
      this._currentBufferSource = null;
    }
    if (this.currentVoiceAudio) {
      this.currentVoiceAudio.onended = null;
      this.currentVoiceAudio.onerror = null;
      this.currentVoiceAudio.onplay = null;
      this.currentVoiceAudio.pause();
      this.currentVoiceAudio.currentTime = 0;
      this.currentVoiceAudio = null;
    }
    this._setSpeakingState(false);
    this._setMusicDucking(false);

    this._emitVoiceProgress({
      active: false,
      isPaused: false,
      percent: 0,
      elapsedSec: 0,
      totalSec: 0,
      roleLabel: '',
      stepId: this._currentStepId,
      completed: false
    });
  }

  _setSpeakingState(speaking) {
    this.isSpeaking = speaking;
    if (typeof this.onSpeakingStatusChange === 'function') {
      this.onSpeakingStatusChange(speaking);
    }
  }

  _startVoiceProgressTicker() {
    this._stopVoiceProgressTicker();
    this._progressTicker = setInterval(() => {
      this._tickVoiceProgress();
    }, 40);
  }

  _stopVoiceProgressTicker() {
    if (this._progressTicker) {
      clearInterval(this._progressTicker);
      this._progressTicker = null;
    }
  }

  _tickVoiceProgress() {
    if (!this.isSpeaking || this._isVoicePaused) return;

    const now = performance.now();
    const elapsed = this._masterPausedOffset + (now - this._masterStartTime) / 1000;
    const clampedElapsed = Math.max(0, Math.min(this._totalVoiceDuration, elapsed));
    const percent = Math.min(99.5, Math.max(0, (clampedElapsed / this._totalVoiceDuration) * 100));

    let currentLabel = this._currentRoleLabel || '語音提示';
    for (const it of this._timelineItems) {
      if (clampedElapsed >= it.startTime && clampedElapsed <= it.endTime) {
        currentLabel = it.roleLabel;
        break;
      }
    }
    this._currentRoleLabel = currentLabel;

    this._emitVoiceProgress({
      active: true,
      isPaused: false,
      percent,
      elapsedSec: clampedElapsed,
      totalSec: this._totalVoiceDuration,
      roleLabel: currentLabel,
      stepId: this._currentStepId,
      completed: false
    });
  }

  _emitVoiceProgress(info) {
    if (typeof this.onVoiceProgress === 'function') {
      try {
        this.onVoiceProgress(info);
      } catch (err) {
        console.warn('onVoiceProgress 回呼執行錯誤:', err);
      }
    }
  }

  startRelaxingMusic() {
    if (!this.musicEnabled) return;
    if (this.isMusicPlaying) return;

    this.ensureAudioContext();
    this.isMusicPlaying = true;
    this._setMusicDucking(this.isSpeaking);

    if (this.musicStyle === 'custom_mp3' && this.customMusicAudio) {
      this.customMusicAudio.loop = true;
      this.customMusicAudio.volume = this.isSpeaking
        ? this.musicVolume * this.duckingRatio
        : this.musicVolume;
      this.customMusicAudio.play().catch(err => console.warn('自訂音樂播放失敗:', err));
    } else {
      this._startGenerativeMusicLoop();
    }

    if (typeof this.onMusicStatusChange === 'function') {
      this.onMusicStatusChange(true);
    }
  }

  stopRelaxingMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimerId) {
      clearInterval(this.musicTimerId);
      this.musicTimerId = null;
    }
    if (this.customMusicAudio) {
      this.customMusicAudio.pause();
    }
    if (typeof this.onMusicStatusChange === 'function') {
      this.onMusicStatusChange(false);
    }
  }

  toggleRelaxingMusic() {
    if (this.isMusicPlaying) {
      this.stopRelaxingMusic();
    } else {
      this.musicEnabled = true;
      this.startRelaxingMusic();
    }
    return this.isMusicPlaying;
  }

  setMusicVolume(vol) {
    this.musicVolume = Math.max(0, Math.min(1, parseFloat(vol) || 0));
    this._setMusicDucking(this.isSpeaking);
  }

  setCustomMusicFile(file) {
    if (!file) return;
    const wasPlaying = this.isMusicPlaying;
    this.stopRelaxingMusic();

    if (this.customMusicObjectUrl) {
      URL.revokeObjectURL(this.customMusicObjectUrl);
    }
    this.customMusicObjectUrl = URL.createObjectURL(file);
    this.customMusicAudio = new Audio(this.customMusicObjectUrl);
    this.customMusicAudio.loop = true;
    this.musicStyle = 'custom_mp3';

    if (wasPlaying) {
      this.startRelaxingMusic();
    }
  }

  setCustomStepVoiceFile(stepId, file) {
    if (!stepId || !file) return;
    if (this.customStepVoiceUrls[stepId]) {
      URL.revokeObjectURL(this.customStepVoiceUrls[stepId]);
    }
    this.customStepVoiceUrls[stepId] = URL.createObjectURL(file);
  }

  _startGenerativeMusicLoop() {
    if (this.musicTimerId) {
      clearInterval(this.musicTimerId);
    }

    const progressions = [
      { pad: [130.81, 196.00, 246.94, 293.66], melody: [523.25, 587.33, 659.25, 783.99, 987.77] },
      { pad: [174.61, 220.00, 261.63, 329.63], melody: [523.25, 659.25, 698.46, 880.00, 1046.50] },
      { pad: [110.00, 164.81, 196.00, 261.63], melody: [440.00, 523.25, 587.33, 659.25, 783.99] },
      { pad: [196.00, 246.94, 293.66, 329.63], melody: [493.88, 587.33, 659.25, 783.99, 880.00] }
    ];

    let barIndex = 0;

    const playBar = () => {
      if (!this.isMusicPlaying || !this.audioCtx || this.musicStyle === 'custom_mp3') return;

      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const chord = progressions[barIndex % progressions.length];
      barIndex++;

      chord.pad.forEach((freq) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = this.musicStyle === 'healing_bells' ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(620, now);

        gain.gain.setValueAtTime(0.0005, now);
        gain.gain.linearRampToValueAtTime(0.042, now + 1.4);
        gain.gain.linearRampToValueAtTime(0.028, now + 2.8);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + 4.3);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterMusicGain);

        osc.start(now);
        osc.stop(now + 4.35);
      });

      const noteOffsets = [0.2, 1.2, 2.2, 3.1];
      noteOffsets.forEach((offset, idx) => {
        if (idx === 3 && barIndex % 2 === 1) return;

        const noteFreq = chord.melody[(barIndex + idx * 2) % chord.melody.length];
        const startTime = now + offset;

        const osc = ctx.createOscillator();
        const overtone = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(noteFreq, startTime);

        overtone.type = 'sine';
        overtone.frequency.setValueAtTime(noteFreq * 2, startTime);

        const overtoneGain = ctx.createGain();
        overtoneGain.gain.setValueAtTime(this.musicStyle === 'healing_bells' ? 0.025 : 0.012, startTime);

        gain.gain.setValueAtTime(0.0005, startTime);
        gain.gain.linearRampToValueAtTime(0.075, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0006, startTime + 2.1);

        osc.connect(gain);
        overtone.connect(overtoneGain);
        overtoneGain.connect(gain);
        gain.connect(this.masterMusicGain);

        osc.start(startTime);
        overtone.start(startTime);
        osc.stop(startTime + 2.15);
        overtone.stop(startTime + 2.15);
      });
    };

    playBar();
    this.musicTimerId = setInterval(playBar, 4000);
  }
}

window.OHAudioEngine = OHAudioEngine;
