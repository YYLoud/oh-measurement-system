/**
 * 姿勢性低血壓 (Orthostatic Hypotension) 臨床判讀與病歷摘要產生器
 * 依據 AAS / EFAS 國際臨床共識標準與台灣臨床實務規範
 */

class OHClinicalEvaluator {
  /**
   * 解析數值（空白或非數字回傳 null）
   */
  static parseNum(val) {
    if (val === '' || val === null || val === undefined) return null;
    const n = Number(val);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  /**
   * 計算單一階段相對於平躺基準值 (Supine Baseline) 的差值與單階段達標狀態
   * @param {Object} baseline { sbp, dbp, hr }
   * @param {Object} stage { sbp, dbp, hr, symptoms: [] }
   */
  static evaluateStageDelta(baseline, stage) {
    const baseSbp = this.parseNum(baseline?.sbp);
    const baseDbp = this.parseNum(baseline?.dbp);
    const baseHr = this.parseNum(baseline?.hr);

    const curSbp = this.parseNum(stage?.sbp);
    const curDbp = this.parseNum(stage?.dbp);
    const curHr = this.parseNum(stage?.hr);

    // 計算差值：站立值 - 平躺值 (例如 100 - 125 = -25 mmHg，代表下降 25 mmHg)
    const deltaSbp = baseSbp !== null && curSbp !== null ? curSbp - baseSbp : null;
    const deltaDbp = baseDbp !== null && curDbp !== null ? curDbp - baseDbp : null;
    const deltaHr = baseHr !== null && curHr !== null ? curHr - baseHr : null;

    // 判斷是否達標：收縮壓下降 >= 20 (deltaSbp <= -20) 或 舒張壓下降 >= 10 (deltaDbp <= -10)
    const sbpDropMet = deltaSbp !== null && deltaSbp <= -20;
    const dbpDropMet = deltaDbp !== null && deltaDbp <= -10;
    const sbpDropSevere = deltaSbp !== null && deltaSbp <= -30;

    const symptoms = Array.isArray(stage?.symptoms) ? stage.symptoms : [];
    const activeSymptoms = symptoms.filter(s => s !== 'none');

    return {
      sbp: curSbp,
      dbp: curDbp,
      hr: curHr,
      deltaSbp,
      deltaDbp,
      deltaHr,
      sbpDropMet,
      dbpDropMet,
      sbpDropSevere,
      isStagePositive: sbpDropMet || dbpDropMet,
      hasSymptoms: activeSymptoms.length > 0,
      activeSymptoms
    };
  }

  /**
   * 綜合評估整份測量紀錄
   * @param {Object} record 包含 supine, sitting, stand1, stand3, abortedEarly, abortReason 等
   */
  static evaluateRecord(record) {
    const supine = {
      sbp: this.parseNum(record?.measurements?.supine?.sbp),
      dbp: this.parseNum(record?.measurements?.supine?.dbp),
      hr: this.parseNum(record?.measurements?.supine?.hr),
      symptoms: (record?.measurements?.supine?.symptoms || []).filter(s => s !== 'none')
    };

    const sittingEval = this.evaluateStageDelta(supine, record?.measurements?.sitting);
    const stand1Eval = this.evaluateStageDelta(supine, record?.measurements?.stand1);
    const stand3Eval = this.evaluateStageDelta(supine, record?.measurements?.stand3);

    const hasBaseline = supine.sbp !== null && supine.dbp !== null;
    const hasAnyOrthostaticMeasurement =
      sittingEval.sbp !== null ||
      stand1Eval.sbp !== null ||
      stand3Eval.sbp !== null;

    // 找出最大收縮壓下降、最大舒張壓下降與最大心跳變化
    const orthoEvals = [
      { key: 'sitting', label: '坐姿', data: sittingEval },
      { key: 'stand1', label: '站立 1 分鐘', data: stand1Eval },
      { key: 'stand3', label: '站立 3 分鐘', data: stand3Eval }
    ].filter(item => item.data.sbp !== null || item.data.dbp !== null || item.data.hr !== null);

    let maxSbpDrop = null; // 取最負的值，例如 -26
    let maxSbpDropStage = '';
    let maxDbpDrop = null;
    let maxDbpDropStage = '';
    let maxHrChange = null;
    let correspondingHrChangeAtMaxDrop = null;

    orthoEvals.forEach(item => {
      const { deltaSbp, deltaDbp, deltaHr } = item.data;
      if (deltaSbp !== null && (maxSbpDrop === null || deltaSbp < maxSbpDrop)) {
        maxSbpDrop = deltaSbp;
        maxSbpDropStage = item.label;
        correspondingHrChangeAtMaxDrop = deltaHr;
      }
      if (deltaDbp !== null && (maxDbpDrop === null || deltaDbp < maxDbpDrop)) {
        maxDbpDrop = deltaDbp;
        maxDbpDropStage = item.label;
      }
      if (deltaHr !== null && (maxHrChange === null || deltaHr > maxHrChange)) {
        maxHrChange = deltaHr;
      }
    });

    // 收集所有出現過的臨床症狀
    const allSymptomIds = new Set([
      ...sittingEval.activeSymptoms,
      ...stand1Eval.activeSymptoms,
      ...stand3Eval.activeSymptoms
    ]);
    const hasOrthostaticSymptoms = allSymptomIds.size > 0 || Boolean(record?.abortedEarly);

    // 判斷是否符合姿勢性低血壓標準 (OH Positive)
    const isPositiveOH =
      sittingEval.isStagePositive ||
      stand1Eval.isStagePositive ||
      stand3Eval.isStagePositive;

    // 檢查是否為仰臥位高血壓 (平躺收縮壓 >= 160 或 舒張壓 >= 100)
    const hasSupineHypertension =
      (supine.sbp !== null && supine.sbp >= 160) ||
      (supine.dbp !== null && supine.dbp >= 100);

    // 臨床狀態與建議生成
    let status = 'pending'; // 'pending' | 'normal' | 'positive' | 'symptomatic_borderline'
    let headline = '尚待輸入完整血壓數值';
    let summaryText = '請先完成「平躺基準值」以及「站立 1 分鐘 / 3 分鐘」之血壓與心跳輸入，系統將自動計算壓差並判讀。';
    const clinicalNotes = [];

    if (hasBaseline && (hasAnyOrthostaticMeasurement || record?.abortedEarly)) {
      if (isPositiveOH) {
        status = 'positive';
        const symptomTag = hasOrthostaticSymptoms ? '有症狀性 (Symptomatic)' : '無症狀性 (Asymptomatic)';
        headline = `陽性：符合姿勢性低血壓診斷標準 (${symptomTag} OH)`;

        const triggers = [];
        if (maxSbpDrop !== null && maxSbpDrop <= -20) {
          triggers.push(`${maxSbpDropStage}收縮壓下降 ${Math.abs(maxSbpDrop)} mmHg (≥20 mmHg)`);
        }
        if (maxDbpDrop !== null && maxDbpDrop <= -10) {
          triggers.push(`${maxDbpDropStage}舒張壓下降 ${Math.abs(maxDbpDrop)} mmHg (≥10 mmHg)`);
        }
        summaryText = `病患於姿勢改變後出現明顯血壓下降：${triggers.join('、')}，符合姿勢性低血壓 (Orthostatic Hypotension) 標準。`;

        // 細分發生時間點
        if (stand1Eval.isStagePositive && !stand3Eval.isStagePositive && stand3Eval.sbp !== null) {
          clinicalNotes.push('站立第 1 分鐘即達低血壓標準，第 3 分鐘部分回升，屬早期典型姿勢性低血壓表現。');
        } else if (!stand1Eval.isStagePositive && stand3Eval.isStagePositive) {
          clinicalNotes.push('站立第 1 分鐘尚未達標，至第 3 分鐘才出現顯著血壓下降，顯示代償機制隨站立時間延長而衰竭。');
        } else if (stand1Eval.isStagePositive && stand3Eval.isStagePositive) {
          clinicalNotes.push('站立第 1 分鐘與第 3 分鐘皆持續維持低血壓狀態，請特別注意病患下床與行走之跌倒風險。');
        }

        // 心率代償反應與 ΔHR/ΔSBP 比值分析 (Neurogenic vs Non-neurogenic OH 實證判讀)
        // 依據 Gibbons et al. (J Neurol 2017, PMID: 28050656) 與 Norcliffe-Kaufmann et al. (Ann Neurol 2018, PMID: 29405350)
        if (correspondingHrChangeAtMaxDrop !== null && maxSbpDrop !== null && maxSbpDrop < 0) {
          const absSbpDrop = Math.abs(maxSbpDrop);
          const hrRaise = Math.max(0, correspondingHrChangeAtMaxDrop);
          const hrSbpRatio = absSbpDrop > 0 ? Number((hrRaise / absSbpDrop).toFixed(2)) : null;
          const ratioStr = hrSbpRatio !== null ? `，且 ΔHR/ΔSBP 比值為 ${hrSbpRatio} bpm/mmHg` : '';

          if (correspondingHrChangeAtMaxDrop < 15 || (hrSbpRatio !== null && hrSbpRatio < 0.5)) {
            clinicalNotes.push(
              `心率代償分析：血壓下降時心跳變化為 ${correspondingHrChangeAtMaxDrop > 0 ? '+' + correspondingHrChangeAtMaxDrop : correspondingHrChangeAtMaxDrop} bpm (< 15 bpm)${ratioStr} (< 0.5 bpm/mmHg)。代償性心跳加速反應鈍化，高度提示「神經源性姿勢性低血壓 (Neurogenic OH)」、自主神經病變或使用抑制心率藥物（如 β-blockers）之可能性 [依據：Gibbons et al., 2017; Norcliffe-Kaufmann et al., 2018]。`
            );
          } else {
            clinicalNotes.push(
              `心率代償分析：血壓下降時伴隨明顯代償性心跳增加 (+${correspondingHrChangeAtMaxDrop} bpm ≥ 15 bpm)${ratioStr} (≥ 0.5 bpm/mmHg)，臨床上請優先評估「非神經源性原因」，如體液容積不足（脫水、出血、利尿劑）或血管擴張藥物影響 [依據：Gibbons et al., 2017; Norcliffe-Kaufmann et al., 2018]。`
            );
          }
        }

        if (hasSupineHypertension) {
          const met30 = maxSbpDrop !== null && maxSbpDrop <= -30;
          clinicalNotes.push(
            `合併仰臥位高血壓提示：平躺基準血壓較高 (${supine.sbp}/${supine.dbp} mmHg)，${
              met30
                ? '且收縮壓下降亦已超過 30 mmHg 之嚴格標準。'
                : '部分專家共識針對仰臥位高血壓建議參考收縮壓下降 ≥ 30 mmHg 標準，請結合臨床症狀綜合判斷。'
            }`
          );
        }
      } else if (record?.abortedEarly || hasOrthostaticSymptoms) {
        status = 'symptomatic_borderline';
        headline = record?.abortedEarly
          ? '警示：因病患明顯不適提前中止站立測試'
          : '注意：血壓未達下降標準，但病患出現姿勢性不適症狀';
        summaryText = record?.abortedEarly
          ? `測試過程因病患無法耐受站立而提前中止（原因：${record.abortReason || '頭暈/站立不穩'}）。即使已測得之血壓未達 20/10 mmHg 降幅，臨床上仍具高度跌倒風險。`
          : `站立後收縮壓最大變化為 ${maxSbpDrop !== null ? (maxSbpDrop > 0 ? '+' + maxSbpDrop : maxSbpDrop) : '--'} mmHg、舒張壓最大變化為 ${maxDbpDrop !== null ? (maxDbpDrop > 0 ? '+' + maxDbpDrop : maxDbpDrop) : '--'} mmHg（未達 ≥20/10 mmHg 標準），但病患伴隨不適症狀，仍建議衛教緩慢改變姿勢。`;
      } else {
        status = 'normal';
        headline = '陰性：未達姿勢性低血壓標準 (Normal Orthostatic Response)';
        summaryText = `站立 3 分鐘內收縮壓最大變化為 ${maxSbpDrop !== null ? (maxSbpDrop > 0 ? '+' + maxSbpDrop : maxSbpDrop) : '0'} mmHg，舒張壓最大變化為 ${maxDbpDrop !== null ? (maxDbpDrop > 0 ? '+' + maxDbpDrop : maxDbpDrop) : '0'} mmHg，未出現 ≥20/10 mmHg 之血壓下降，且無伴隨不適症狀。`;
      }

      // 姿勢性心搏過速症候群 (POTS) 篩檢提示
      if (!isPositiveOH && maxHrChange !== null && maxHrChange >= 30) {
        clinicalNotes.push(
          `姿勢性心搏過速提示：站立後血壓雖未達低血壓標準，但心跳顯著增加 +${maxHrChange} bpm (≥ 30 bpm)，建議留意姿勢性心搏過速症候群 (POTS) 或體液容積不足之可能性。`
        );
      }
    }

    return {
      status,
      headline,
      summaryText,
      clinicalNotes,
      isPositiveOH,
      hasOrthostaticSymptoms,
      hasSupineHypertension,
      supine,
      sittingEval,
      stand1Eval,
      stand3Eval,
      maxSbpDrop,
      maxDbpDrop,
      maxHrChange,
      allSymptomIds: Array.from(allSymptomIds)
    };
  }

  /**
   * 格式化壓差數值為易讀字串 (如 "-24 mmHg" 或 "+4 mmHg")
   */
  static formatDelta(delta, unit = '') {
    if (delta === null || delta === undefined) return '—';
    const sign = delta > 0 ? `+${delta}` : `${delta}`;
    return unit ? `${sign} ${unit}` : sign;
  }

  /**
   * 將症狀 ID 陣列轉為台灣中文名稱字串
   */
  static formatSymptomsText(symptomIds) {
    if (!Array.isArray(symptomIds) || symptomIds.length === 0) return '無不適症狀';
    const filtered = symptomIds.filter(id => id !== 'none');
    if (filtered.length === 0) return '無不適症狀';

    const map = {};
    (window.OH_SYMPTOM_OPTIONS || []).forEach(opt => {
      map[opt.id] = opt.label;
    });
    return filtered.map(id => map[id] || id).join('、');
  }

  /**
   * 產生台灣醫院臨床病歷摘要文字 (方便直接貼入 HIS / SOAP Note)
   */
  static generateClinicalNote(record, evaluation) {
    const p = record.patient || {};
    const m = record.measurements || {};
    const evalRes = evaluation || this.evaluateRecord(record);

    const fmtStage = (label, raw, evalObj, isBase = false) => {
      const sbp = this.parseNum(raw?.sbp);
      const dbp = this.parseNum(raw?.dbp);
      const hr = this.parseNum(raw?.hr);
      if (sbp === null && dbp === null && hr === null) return null;

      const bpStr = `${sbp ?? '--'}/${dbp ?? '--'} mmHg`;
      const hrStr = `HR ${hr ?? '--'} bpm`;
      const symStr = this.formatSymptomsText(raw?.symptoms);

      if (isBase) {
        return `- ${label}：BP ${bpStr}, ${hrStr} (基準值 Baseline) | 症狀：${symStr}`;
      }
      const dSbp = this.formatDelta(evalObj?.deltaSbp);
      const dDbp = this.formatDelta(evalObj?.deltaDbp);
      const dHr = this.formatDelta(evalObj?.deltaHr);
      const flag = evalObj?.isStagePositive ? ' [★達標]' : '';
      return `- ${label}：BP ${bpStr} (ΔSBP ${dSbp}, ΔDBP ${dDbp}), ${hrStr} (ΔHR ${dHr})${flag} | 症狀：${symStr}`;
    };

    const lines = [
      '【姿勢性低血壓檢測紀錄 (Orthostatic Blood Pressure Measurement)】',
      `檢測時間：${record.measuredAt || new Date().toLocaleString('zh-TW')} | 測量部位：${p.arm || '左手'} (${p.cuffSize || '標準壓脈帶'})`,
      `病患資料：姓名 ${p.name || '未填'} | 病歷號 ${p.chartId || '未填'}${p.age ? ` | 年齡 ${p.age} 歲` : ''}${p.gender ? ` (${p.gender})` : ''}`,
      '------------------------------------------------------------',
      '【各階段血壓與心率變化】'
    ];

    const supineLine = fmtStage('平躺靜息 5 分鐘 (Supine)', m.supine, null, true);
    const sittingLine = fmtStage('坐姿過渡 (Sitting)', m.sitting, evalRes.sittingEval);
    const stand1Line = fmtStage('站立 1 分鐘 (Standing 1 min)', m.stand1, evalRes.stand1Eval);
    const stand3Line = fmtStage('站立 3 分鐘 (Standing 3 min)', m.stand3, evalRes.stand3Eval);

    if (supineLine) lines.push(supineLine);
    if (sittingLine) lines.push(sittingLine);
    if (stand1Line) lines.push(stand1Line);
    if (stand3Line) lines.push(stand3Line);

    if (record.abortedEarly) {
      lines.push(`※ 備註警示：測試因病患不適提前中止 (${record.abortReason || '站立不穩/頭暈'})`);
    }

    lines.push('------------------------------------------------------------');
    lines.push(`【臨床判讀結果】${evalRes.headline}`);
    lines.push(`【判讀說明】${evalRes.summaryText}`);

    if (evalRes.clinicalNotes && evalRes.clinicalNotes.length > 0) {
      evalRes.clinicalNotes.forEach(note => {
        lines.push(`  • ${note}`);
      });
    }

    if (p.notes && p.notes.trim()) {
      lines.push(`【醫護臨床備註】${p.notes.trim()}`);
    }

    return lines.join('\n');
  }
}

window.OHClinicalEvaluator = OHClinicalEvaluator;
