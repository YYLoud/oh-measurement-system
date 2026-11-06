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

    this._setSpeakingState(true);
    this._setMusicDucking(true);
    this.playChime(chimeType);

    if (stepId && this.customStepVoiceUrls[stepId] && !singleText && !forceLang) {
      setTimeout(() => {
        this._playQueue([{ type: 'audio', lang: 'tw', url: this.customStepVoiceUrls[stepId] }], 0);
      }, 480);
      return;
    }

    const queue = [];
    const mode = this.languageMode;

    const pushZhItem = (zhUrl, text, pitch = 1.0, rate = this.speechRate) => {
      if (zhUrl) {
        queue.push({ type: 'audio', lang: 'zh', url: zhUrl, fallbackText: text });
      } else if (text) {
        queue.push({ type: 'tts', lang: 'zh', text, pitch, rate });
      }
    };

    const pushTwItem = (twUrl, fallbackText) => {
      if (twUrl) {
        queue.push({ type: 'audio', lang: 'tw', url: twUrl, fallbackText });
      } else if (fallbackText) {
        queue.push({ type: 'tts', lang: 'zh', text: fallbackText, pitch: 1.0, rate: this.speechRate });
      }
    };

    if (singleText || singleTwAudioUrl || singleZhAudioUrl) {
      const useTw =
        forceLang === 'tw' ||
        (forceLang !== 'zh' && mode === 'all_tw');

      if (useTw && singleTwAudioUrl) {
        pushTwItem(singleTwAudioUrl, singleText);
      } else {
        pushZhItem(singleZhAudioUrl, singleText, 1.0, this.speechRate);
      }
    } else {
      // 1. 對病患的語音提示
      if (roleFilter === 'both' || roleFilter === 'patient') {
        const patientSpokenZh = patientText ? `病患請注意：${patientText}` : '';
        if (forceLang === 'tw') {
          pushTwItem(patientTwAudioUrl, patientSpokenZh);
        } else if (forceLang === 'zh') {
          pushZhItem(patientZhAudioUrl, patientSpokenZh, 1.04, Math.max(0.82, this.speechRate - 0.04));
        } else if (mode === 'patient_tw_staff_zh' || mode === 'all_tw') {
          if (patientTwAudioUrl) {
            pushTwItem(patientTwAudioUrl, patientSpokenZh);
          } else {
            pushZhItem(patientZhAudioUrl, patientSpokenZh, 1.04, this.speechRate);
          }
        } else if (mode === 'patient_both_staff_zh') {
          pushZhItem(patientZhAudioUrl, patientSpokenZh, 1.04, Math.max(0.82, this.speechRate - 0.04));
          if (patientTwAudioUrl) {
            pushTwItem(patientTwAudioUrl, '');
          }
        } else {
          pushZhItem(patientZhAudioUrl, patientSpokenZh, 1.04, Math.max(0.82, this.speechRate - 0.04));
        }
      }

      // 2. 對醫護人員的語音提示
      if (roleFilter === 'both' || roleFilter === 'staff') {
        if (forceLang === 'tw') {
          pushTwItem(staffTwAudioUrl, staffText);
        } else if (forceLang === 'zh') {
          pushZhItem(staffZhAudioUrl, staffText, 0.98, this.speechRate);
        } else if (mode === 'all_tw' && staffTwAudioUrl) {
          pushTwItem(staffTwAudioUrl, staffText);
        } else {
          pushZhItem(staffZhAudioUrl, staffText, 0.98, this.speechRate);
        }
      }
    }

    if (queue.length === 0) {
      this._setSpeakingState(false);
      this._setMusicDucking(false);
      return;
    }

    setTimeout(() => {
      this._playQueue(queue, 0);
    }, 520);
  }

  /**
   * 依序執行混合佇列（台語與國語 MP3 皆透過 Web Audio API 專屬 GainNode 即時控音）
   */
  _playQueue(queue, index) {
    if (!this.isSpeaking || index >= queue.length) {
      this._setSpeakingState(false);
      this._setMusicDucking(false);
      return;
    }

    const item = queue[index];
    const proceedNext = () => {
      if (!this.isSpeaking) return;
      if (index + 1 < queue.length) {
        setTimeout(() => {
          this._playQueue(queue, index + 1);
        }, 420);
      } else {
        this._setSpeakingState(false);
        this._setMusicDucking(false);
      }
    };

    if (item.type === 'audio' && item.url) {
      this._playBoostedVoiceAudio(item.url, item.lang || 'tw', item.fallbackText, proceedNext);
    } else if (item.type === 'tts' && item.text) {
      this._speakSingleUtterance(item.text, item.pitch, item.rate, proceedNext);
    } else {
      proceedNext();
    }
  }

  /**
   * 使用 Web Audio API 將台語或國語 MP3 解碼並透過各自獨立的 GainNode 控制音量（突破瀏覽器 TTS 限制且支援播報中即時調音量）
   */
  _playBoostedVoiceAudio(url, lang = 'tw', fallbackText = '', onComplete = null) {
    this.ensureAudioContext();
    const isMandarin = lang === 'zh';
    const targetGainNode = isMandarin ? this.mandarinGainNode : this.taiwaneseGainNode;

    const playDecodedBuffer = (arrayBuffer) => {
      if (!this.isSpeaking) return;
      this.audioCtx.decodeAudioData(
        arrayBuffer,
        (audioBuffer) => {
          if (!this.isSpeaking) return;
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

          this._currentBufferSource = source;
          source.onended = () => {
            this._currentBufferSource = null;
            if (onComplete) onComplete();
          };
          source.start(0);
        },
        () => {
          this._fallbackHtmlAudioPlay(url, lang, fallbackText, onComplete);
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
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';

    xhr.onload = () => {
      if ((xhr.status === 200 || xhr.status === 0) && xhr.response) {
        playDecodedBuffer(xhr.response);
      } else {
        this._fallbackHtmlAudioPlay(url, lang, fallbackText, onComplete);
      }
    };

    xhr.onerror = () => {
      this._fallbackHtmlAudioPlay(url, lang, fallbackText, onComplete);
    };

    xhr.send();
  }

  /**
   * 當瀏覽器因 file:// 安全性限制阻擋 XHR 時，使用 HTML5 Audio + Web Audio MediaElementSource 控制音量
   */
  _fallbackHtmlAudioPlay(url, lang = 'tw', fallbackText = '', onComplete = null) {
    if (!this.isSpeaking) return;
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
      this.currentVoiceAudio = null;
      if (onComplete) onComplete();
    };

    audio.onerror = () => {
      this.currentVoiceAudio = null;
      if (fallbackText) {
        this._speakSingleUtterance(fallbackText, 1.0, this.speechRate, onComplete);
      } else if (onComplete) {
        onComplete();
      }
    };

    audio.play().catch(() => {
      this.currentVoiceAudio = null;
      if (fallbackText) {
        this._speakSingleUtterance(fallbackText, 1.0, this.speechRate, onComplete);
      } else if (onComplete) {
        onComplete();
      }
    });
  }

  _speakSingleUtterance(text, pitch = 1.0, rate = 0.96, onComplete) {
    if (!('speechSynthesis' in window)) {
      if (onComplete) onComplete();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    const voice = this.getSelectedVoice();
    if (voice) {
      utterance.voice = voice;
    }
    // 使用獨立的「國語音量 (mandarinVolume)」，若為 Web Speech API 則安全限制在 0.0 ~ 1.0
    utterance.volume = Math.max(0, Math.min(1.0, this.mandarinVolume));
    utterance.rate = rate || this.speechRate;
    utterance.pitch = pitch || 1.0;

    utterance.onend = () => {
      if (onComplete) onComplete();
    };
    utterance.onerror = () => {
      if (onComplete) onComplete();
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * 立即停止目前正在播報的國語或台語語音
   */
  stopSpeech() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this._currentBufferSource) {
      try {
        this._currentBufferSource.stop();
      } catch (e) {}
      this._currentBufferSource = null;
    }
    if (this.currentVoiceAudio) {
      this.currentVoiceAudio.pause();
      this.currentVoiceAudio.currentTime = 0;
      this.currentVoiceAudio = null;
    }
    this._setSpeakingState(false);
    this._setMusicDucking(false);
  }

  _setSpeakingState(speaking) {
    this.isSpeaking = speaking;
    if (typeof this.onSpeakingStatusChange === 'function') {
      this.onSpeakingStatusChange(speaking);
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
