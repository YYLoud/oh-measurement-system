# 姿勢性低血壓 (OH) 測量語音指導與臨床記錄系統
**Orthostatic Hypotension Guided Measurement & Clinical Documentation System (台灣國語／台語雙語臨床版)**

一套專為台灣臨床醫療環境設計、可於電腦、平板與手機瀏覽器直接開啟（亦可部署於 GitHub Pages）的**姿勢性低血壓（Orthostatic Hypotension, OH）測量語音指導與臨床記錄系統**。

---

## ✨ 系統核心功能

### 第一部分：互動式語音測量指導與等待輕音樂
1. **標準臨床測量流程引導**：
   - 支援標準流程（測量前準備 ➔ 平躺靜息 5 分鐘 ➔ 平躺基準血壓測量 ➔ 站立第 1 分鐘測量 ➔ 站立第 3 分鐘測量 ➔ 完成），並可勾選啟用「坐姿過渡測量」階段或「⚡ 15秒快速測試模式」。
2. **台灣台語（Taiwanese Hokkien）與台灣國語（`zh-TW`）雙語播報**：
   - 內建 18 個預合成道地台語語音檔（`audio/taiwanese/*.mp3` 與 `js/taiwanese-audio-data.js`），免連網開箱即用。
   - 提供四種播報搭配模式：**「病患：台語 ／ 醫護：國語 (推薦)」**、**「全台語模式」**、**「病患：國語＋台語 ／ 醫護：國語」**、**「全國語模式」**。
   - **台語與國語獨立音量滑桿**：內建 Web Audio API `GainNode` 增幅放大器與防破音動態壓縮器，台語音量最高可獨立放大至 **400%**。
3. **等待期間舒緩輕音樂與智慧音量閃避 (Auto-Ducking)**：
   - 內建 Web Audio API 即時合成之 60 BPM 療癒輕音樂（溫暖鋼琴與弦樂襯底、自然冥想泛音鐘聲），亦支援上傳自訂 MP3/WAV。
   - 當播報台語或國語語音提示時，背景輕音樂會自動平滑調降至 15%，語音結束後自動恢復。

### 第二部分：臨床血壓心率記錄、自動判讀與病歷匯出
1. **即時壓差計算與實證自動判讀**：
   - 即時計算各階段與平躺基準值之 $\Delta\text{SBP}$、$\Delta\text{DBP}$、$\Delta\text{HR}$ 及 $\Delta\text{HR}/\Delta\text{SBP}$ 比值。
   - 依據國際自主神經學會共識（Freeman et al., *Clin Auton Res* 2011, PMID: 21431947）與台灣心臟學會／台灣高血壓學會指引（Wang et al., *Acta Cardiol Sin* 2022, PMID: 35673334）自動判讀是否符合姿勢性低血壓（$\Delta\text{SBP} \le -20\text{ mmHg}$ 或 $\Delta\text{DBP} \le -10\text{ mmHg}$）。
   - 自動分析心率代償反應（$\Delta\text{HR} < 15\text{ bpm}$ 及 $\Delta\text{HR}/\Delta\text{SBP} < 0.5\text{ bpm/mmHg}$）以提供神經源性（Neurogenic OH）與非神經源性鑑別參考（Norcliffe-Kaufmann et al., *Ann Neurol* 2018, PMID: 29405350；Gibbons et al., *J Neurol* 2017, PMID: 28050656）。
2. **病歷摘要複製、本機儲存與報表匯出**：
   - **一鍵複製病歷摘要**：產生結構化臨床文字，可直接貼入醫院電子病歷系統（HIS / SOAP Note）。
   - **Excel (CSV) 匯出**：帶 UTF-8 BOM 編碼，Microsoft Excel 直接開啟繁體中文不亂碼。
   - **列印 / PDF 檢測報告單**：內建 `@media print` 醫院正式單頁報告排版。
3. **手機與平板 (RWD) 觸控最佳化**：
   - 內建行動端「語音指導 ↔ 記錄血壓」快速切換列、純數字九宮格鍵盤自動跳格與防遮擋版面設計。
