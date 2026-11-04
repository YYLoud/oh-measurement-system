/**
 * 姿勢性低血壓 (Orthostatic Hypotension, OH) 測量流程定義
 * 支援：台灣國語 (zh-TW) 與 台灣台語 (Taiwanese Hokkien 預合成音檔 + 台語字幕)
 */

const OH_PROTOCOL_STEPS = [
  {
    id: 'prep',
    stepNumber: 1,
    shortTitle: '測量前準備',
    fullTitle: '階段一：測量前準備與壓脈帶確認',
    badgeText: '準備階段',
    hasTimer: false,
    defaultDurationSec: 0,
    playMusicDuringTimer: false,
    recordStageKey: null,
    staffInstruction: '請確認病患基本資料，選擇合適尺寸的血壓壓脈帶綁於上臂（與心臟同高），並引導病患平躺於檢查床上，雙腿自然伸直不要交叉。',
    patientInstruction: '請配合醫護人員躺平在檢查床上，雙腿自然伸直、不要交叉，全身放鬆即可。',
    patientTaiwaneseSub: '（台語：你好，這馬欲來量血壓。請配合護理師，躺平佇床仔頂，雙跤伸直莫交挐，身軀放輕鬆。）',
    voicePrompt: {
      staff: '醫護人員請注意，請為病患綁好合適尺寸的血壓壓脈帶，高度與心臟同高，並協助病患平躺在檢查床上。',
      patient: '您好，現在準備進行姿勢性低血壓檢查。請配合醫護人員平躺在檢查床上，雙腳自然伸直不要交叉，放鬆身體。'
    },
    taiwaneseAudio: {
      patient: 'audio/taiwanese/prep_patient.mp3',
      staff: 'audio/taiwanese/prep_staff.mp3'
    }
  },
  {
    id: 'supine_rest',
    stepNumber: 2,
    shortTitle: '平躺靜息 5 分鐘',
    fullTitle: '階段二：平躺安靜休息（穩定血流動力學）',
    badgeText: '平躺休息中',
    hasTimer: true,
    defaultDurationSec: 300, // 5 分鐘 (300 秒)
    preAlertSec: 15,         // 結束前 15 秒語音預警
    playMusicDuringTimer: true,
    recordStageKey: null,
    staffInstruction: '請讓病患安靜平躺休息至少 5 分鐘。等待期間系統會播放輕音樂幫助病患放鬆；倒數剩餘 15 秒時，系統會語音提醒您準備啟動血壓計。',
    patientInstruction: '現在開始平躺休息五分鐘。請閉目養神、平穩呼吸，聽著輕音樂放鬆全身，休息期間請盡量不要說話或移動手臂。',
    patientTaiwaneseSub: '（台語：這馬開始躺平歇睏五分鐘。請目睭瞌瞌，勻勻仔喘氣，聽音樂放輕鬆，這段時間請莫講話。）',
    voicePrompt: {
      staff: '現在開始平躺休息五分鐘計時。倒數最後十五秒時，會提醒醫護人員準備量測血壓。',
      patient: '請閉上眼睛、平穩呼吸，聽著輕音樂休息五分鐘。這段期間請放鬆全身，不要說話或移動身體。',
      preAlert: '醫護人員請注意，距離平躺血壓測量還有十五秒，請檢查壓脈帶並準備啟動血壓計。',
      timerDone: '平躺休息五分鐘時間到。請醫護人員現在啟動血壓計，測量平躺時的血壓與心跳。'
    },
    taiwaneseAudio: {
      patient: 'audio/taiwanese/supine_rest_patient.mp3',
      staff: 'audio/taiwanese/supine_rest_staff.mp3',
      preAlert: 'audio/taiwanese/pre_alert.mp3',
      timerDone: 'audio/taiwanese/timer_done.mp3'
    }
  },
  {
    id: 'supine_measure',
    stepNumber: 3,
    shortTitle: '平躺血壓測量',
    fullTitle: '階段三：測量並記錄平躺基準血壓與心跳',
    badgeText: '基準值測量',
    hasTimer: false,
    defaultDurationSec: 0,
    playMusicDuringTimer: false,
    recordStageKey: 'supine',
    staffInstruction: '請啟動血壓計進行測量，完成後在右側「平躺 (基準值)」欄位輸入收縮壓、舒張壓與心跳。測量後請保留壓脈帶，不要取下。',
    patientInstruction: '正在為您測量平躺時的血壓，手臂會有充氣緊縮的感覺，請保持安靜、不要說話或移動手臂。',
    patientTaiwaneseSub: '（台語：這馬咧幫你量躺平的血壓，手骨會有一點仔絚，請保持安靜，莫講話喔。）',
    voicePrompt: {
      staff: '請醫護人員啟動血壓計，測量平躺基準血壓與心跳，並在系統右側輸入數值。測量完成後請不要取下壓脈帶。',
      patient: '現在正在為您量血壓，壓脈帶充氣時手臂會有一點緊，請保持安靜、平穩呼吸，不要說話喔。'
    },
    taiwaneseAudio: {
      patient: 'audio/taiwanese/supine_measure_patient.mp3',
      staff: 'audio/taiwanese/supine_measure_staff.mp3'
    }
  },
  {
    id: 'sitting_transition',
    stepNumber: 3.5,
    shortTitle: '坐姿過渡與測量',
    fullTitle: '選用階段：協助坐起過渡與坐姿血壓測量',
    badgeText: '坐姿過渡 (選用)',
    optionalSitting: true,
    hasTimer: true,
    defaultDurationSec: 60, // 預設 1 分鐘坐姿觀察與測量
    preAlertSec: 15,
    playMusicDuringTimer: true,
    recordStageKey: 'sitting',
    staffInstruction: '請協助病患緩慢坐起於床緣，雙腳自然下垂，注意病患是否有頭暈不穩。坐姿滿 1 分鐘時測量並記錄坐姿血壓、心跳與症狀。',
    patientInstruction: '請在醫護人員協助下慢慢坐到床邊。坐起來的時候如果覺得頭暈、眼花或任何不舒服，請馬上告訴我們。',
    patientTaiwaneseSub: '（台語：這馬請佇醫護人員鬥相共之下，慢慢仔坐起來。假使感覺頭殼眩眩抑是目睭花花，請隨時講一聲喔。）',
    voicePrompt: {
      staff: '請醫護人員協助病患緩慢坐起於床緣，注意防範跌倒，並開始坐姿一分鐘計時。',
      patient: '現在請在醫護人員的協助下慢慢坐起來。如果坐起來覺得頭暈或眼花，請馬上告訴我們喔。',
      preAlert: '醫護人員請注意，距離坐姿血壓測量還有十五秒，請準備啟動血壓計，並詢問病患是否有頭暈不適。',
      timerDone: '坐姿一分鐘時間到。請醫護人員測量並記錄坐姿血壓、心跳與病患症狀。'
    },
    taiwaneseAudio: {
      patient: 'audio/taiwanese/sitting_transition_patient.mp3',
      staff: 'audio/taiwanese/sitting_transition_staff.mp3',
      preAlert: 'audio/taiwanese/pre_alert.mp3',
      timerDone: 'audio/taiwanese/timer_done.mp3'
    }
  },
  {
    id: 'stand_1min',
    stepNumber: 4,
    shortTitle: '站立第 1 分鐘',
    fullTitle: '階段四：協助病患站立並於第 1 分鐘測量',
    badgeText: '站立 1 分鐘',
    hasTimer: true,
    defaultDurationSec: 60, // 站立滿 1 分鐘 (60 秒)
    preAlertSec: 15,
    playMusicDuringTimer: true,
    recordStageKey: 'stand1',
    staffInstruction: '請協助病患平穩站立於地面（雙腳微開與肩同寬，綁壓脈帶的手臂自然支撐於心臟同高處），站好後立即計時 1 分鐘。倒數結束時測量血壓、心跳並主動詢問症狀。',
    patientInstruction: '請在醫護人員協助下慢慢站起來，雙腳平穩踩在地面上。站立期間如果有頭暈、眼花、心悸或快要站不穩，請立刻出聲告訴我們。',
    patientTaiwaneseSub: '（台語：這馬請佇醫護人員鬥相共之下，慢慢仔徛起來，雙跤徛予在。假使感覺頭殼眩眩、目睭花花、抑是徛袂在，請馬上出聲講喔。）',
    voicePrompt: {
      staff: '請醫護人員協助病患平穩站立，支撐測量手臂與心臟同高，現在開始站立第一分鐘計時，請密切注意病患安全。',
      patient: '現在請在醫護人員協助下慢慢站起來。站著的時候如果覺得頭暈、眼花、胸悶或是快要站不穩，請隨時出聲告訴我們喔。',
      preAlert: '醫護人員請注意，距離站立一分鐘測量還有十五秒，請準備啟動血壓計，並觀察病患是否有不適症狀。',
      timerDone: '站立滿一分鐘，請醫護人員立即啟動血壓計測量，並詢問病患是否有頭暈或眼花等症狀，將數值記錄於站立一分鐘欄位。'
    },
    taiwaneseAudio: {
      patient: 'audio/taiwanese/stand_1min_patient.mp3',
      staff: 'audio/taiwanese/stand_1min_staff.mp3',
      preAlert: 'audio/taiwanese/pre_alert.mp3',
      timerDone: 'audio/taiwanese/timer_done.mp3'
    }
  },
  {
    id: 'stand_3min',
    stepNumber: 5,
    shortTitle: '站立第 3 分鐘',
    fullTitle: '階段五：持續站立至第 3 分鐘並進行測量',
    badgeText: '站立 3 分鐘',
    hasTimer: true,
    defaultDurationSec: 120, // 從第 1 分鐘繼續站立 2 分鐘 (120 秒) 即滿 3 分鐘
    preAlertSec: 15,
    playMusicDuringTimer: true,
    recordStageKey: 'stand3',
    staffInstruction: '請讓病患維持站立姿勢再等待 2 分鐘（累計站立達 3 分鐘），期間持續注意跌倒風險。倒數結束時進行最後一次血壓、心跳測量並記錄症狀。',
    patientInstruction: '做得很好！請維持平穩站立與自然呼吸，我們再等兩分鐘就會進行最後一次血壓測量。若中途感到不舒服請隨時告訴我們。',
    patientTaiwaneseSub: '（台語：誠好喔！請繼續平穩徛好勢，勻勻仔喘氣，閣等兩分鐘就做最後一改量血壓囉。若有頭眩不適請隨時講。）',
    voicePrompt: {
      staff: '站立一分鐘測量完成。請讓病患繼續維持站立，現在開始倒數兩分鐘，將於站立滿三分鐘時進行最後一次測量。',
      patient: '請維持平穩站立與自然呼吸，聽著輕音樂放鬆，我們再過兩分鐘就做最後一次血壓測量囉。若有頭暈不適請隨時告訴我們。',
      preAlert: '醫護人員請注意，距離站立滿三分鐘還有十五秒，請準備啟動血壓計進行最後一次測量。',
      timerDone: '站立滿三分鐘時間到。請醫護人員啟動血壓計，測量並記錄站立三分鐘的血壓、心跳與症狀。'
    },
    taiwaneseAudio: {
      patient: 'audio/taiwanese/stand_3min_patient.mp3',
      staff: 'audio/taiwanese/stand_3min_staff.mp3',
      preAlert: 'audio/taiwanese/pre_alert.mp3',
      timerDone: 'audio/taiwanese/timer_done.mp3'
    }
  },
  {
    id: 'complete',
    stepNumber: 6,
    shortTitle: '測量完成與判讀',
    fullTitle: '階段六：測量完成、協助休息與臨床結果判讀',
    badgeText: '檢查完成',
    hasTimer: false,
    defaultDurationSec: 0,
    playMusicDuringTimer: false,
    recordStageKey: null,
    staffInstruction: '所有階段測量已完成！請先協助病患安全坐下或躺回檢查床並取下壓脈帶。接著請確認右側系統自動判讀結果，點擊「儲存本次紀錄」或匯出病歷摘要。',
    patientInstruction: '所有的血壓測量都已經順利完成，您辛苦了！請在醫護人員協助下慢慢坐下來休息。',
    patientTaiwaneseSub: '（台語：所有的血壓攏量好勢囉，真勞力，辛苦你矣！請慢慢仔坐落來歇睏。）',
    voicePrompt: {
      staff: '姿勢性低血壓所有測量階段已經完成。請先協助病患安全坐下休息並取下壓脈帶，接著於系統右側確認臨床判讀結果與儲存紀錄。',
      patient: '所有的血壓測量都已經完成囉，您辛苦了！請在醫護人員的協助下慢慢坐下來休息。'
    },
    taiwaneseAudio: {
      patient: 'audio/taiwanese/complete_patient.mp3',
      staff: 'audio/taiwanese/complete_staff.mp3'
    }
  }
];

/**
 * 台灣臨床常見姿勢性低血壓伴隨症狀清單
 */
const OH_SYMPTOM_OPTIONS = [
  { id: 'none', label: '無不適症狀', en: 'Asymptomatic', isNormal: true },
  { id: 'dizziness', label: '頭暈 / 眩暈', en: 'Dizziness / Vertigo' },
  { id: 'lightheaded', label: '頭重腳輕 / 腦袋空空', en: 'Lightheadedness' },
  { id: 'blurred_vision', label: '眼花 / 視力模糊 / 眼前發黑', en: 'Blurred or tunnel vision' },
  { id: 'weakness', label: '全身無力 / 雙腿發軟', en: 'Weakness / Buckling of legs' },
  { id: 'palpitation', label: '心悸 / 胸悶', en: 'Palpitations / Chest tightness' },
  { id: 'neck_pain', label: '肩頸痠痛 (Coat-hanger pain)', en: 'Coat-hanger neck ache' },
  { id: 'presyncope', label: '快要昏倒 / 站立不穩', en: 'Presyncope / Unsteadiness' }
];

window.OH_PROTOCOL_STEPS = OH_PROTOCOL_STEPS;
window.OH_SYMPTOM_OPTIONS = OH_SYMPTOM_OPTIONS;
