/**
 * 姿勢性低血壓紀錄本機儲存 (localStorage) 與 CSV / 列印報告匯出模組
 */

const OH_STORAGE_KEY = 'oh_measurement_records_v1';

class OHStorageManager {
  /**
   * 讀取全部歷史紀錄 (依時間由新到舊排序)
   */
  static getAllRecords() {
    try {
      const raw = localStorage.getItem(OH_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('讀取本機歷史紀錄失敗:', e);
      return [];
    }
  }

  /**
   * 儲存一筆新紀錄或更新現有紀錄
   */
  static saveRecord(record) {
    const records = this.getAllRecords();
    const recordToSave = {
      ...record,
      id: record.id || `oh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      savedAtISO: new Date().toISOString()
    };

    const existingIdx = records.findIndex(r => r.id === recordToSave.id);
    if (existingIdx >= 0) {
      records[existingIdx] = recordToSave;
    } else {
      records.unshift(recordToSave);
    }

    localStorage.setItem(OH_STORAGE_KEY, JSON.stringify(records));
    return recordToSave;
  }

  /**
   * 刪除指定 ID 的紀錄
   */
  static deleteRecord(id) {
    const records = this.getAllRecords().filter(r => r.id !== id);
    localStorage.setItem(OH_STORAGE_KEY, JSON.stringify(records));
    return records;
  }

  /**
   * 清空全部紀錄
   */
  static clearAllRecords() {
    localStorage.removeItem(OH_STORAGE_KEY);
  }

  /**
   * 將歷史紀錄匯出為帶 UTF-8 BOM 的 CSV 檔案 (台灣 Excel 直接開啟不亂碼)
   */
  static exportRecordsToCSV(records) {
    if (!Array.isArray(records) || records.length === 0) {
      return false;
    }

    const headers = [
      '檢測日期時間',
      '病歷號',
      '病患姓名',
      '年齡',
      '性別',
      '測量手臂',
      '壓脈帶尺寸',
      '平躺_SBP(mmHg)',
      '平躺_DBP(mmHg)',
      '平躺_HR(bpm)',
      '平躺_症狀',
      '坐姿_SBP(mmHg)',
      '坐姿_DBP(mmHg)',
      '坐姿_HR(bpm)',
      '坐姿_ΔSBP',
      '坐姿_ΔDBP',
      '坐姿_症狀',
      '站立1分_SBP(mmHg)',
      '站立1分_DBP(mmHg)',
      '站立1分_HR(bpm)',
      '站立1分_ΔSBP',
      '站立1分_ΔDBP',
      '站立1分_ΔHR',
      '站立1分_症狀',
      '站立3分_SBP(mmHg)',
      '站立3分_DBP(mmHg)',
      '站立3分_HR(bpm)',
      '站立3分_ΔSBP',
      '站立3分_ΔDBP',
      '站立3分_ΔHR',
      '站立3分_症狀',
      '最大SBP變化(mmHg)',
      '最大DBP變化(mmHg)',
      '是否因不適提前中止',
      '臨床自動判讀結果',
      '醫護備註'
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = records.map(rec => {
      const p = rec.patient || {};
      const m = rec.measurements || {};
      const evalRes = window.OHClinicalEvaluator.evaluateRecord(rec);

      return [
        rec.measuredAt || '',
        p.chartId || '',
        p.name || '',
        p.age || '',
        p.gender || '',
        p.arm || '',
        p.cuffSize || '',
        m.supine?.sbp ?? '',
        m.supine?.dbp ?? '',
        m.supine?.hr ?? '',
        window.OHClinicalEvaluator.formatSymptomsText(m.supine?.symptoms),
        m.sitting?.sbp ?? '',
        m.sitting?.dbp ?? '',
        m.sitting?.hr ?? '',
        evalRes.sittingEval?.deltaSbp ?? '',
        evalRes.sittingEval?.deltaDbp ?? '',
        window.OHClinicalEvaluator.formatSymptomsText(m.sitting?.symptoms),
        m.stand1?.sbp ?? '',
        m.stand1?.dbp ?? '',
        m.stand1?.hr ?? '',
        evalRes.stand1Eval?.deltaSbp ?? '',
        evalRes.stand1Eval?.deltaDbp ?? '',
        evalRes.stand1Eval?.deltaHr ?? '',
        window.OHClinicalEvaluator.formatSymptomsText(m.stand1?.symptoms),
        m.stand3?.sbp ?? '',
        m.stand3?.dbp ?? '',
        m.stand3?.hr ?? '',
        evalRes.stand3Eval?.deltaSbp ?? '',
        evalRes.stand3Eval?.deltaDbp ?? '',
        evalRes.stand3Eval?.deltaHr ?? '',
        window.OHClinicalEvaluator.formatSymptomsText(m.stand3?.symptoms),
        evalRes.maxSbpDrop ?? '',
        evalRes.maxDbpDrop ?? '',
        rec.abortedEarly ? `是 (${rec.abortReason || '不適'})` : '否',
        evalRes.headline || '',
        p.notes || ''
      ].map(escapeCSV).join(',');
    });

    // 加入 UTF-8 BOM (\uFEFF) 避免 Microsoft Excel 中文亂碼
    const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const dateStr = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `姿勢性低血壓測量紀錄_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  }
}

window.OHStorageManager = OHStorageManager;
