#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
第一屆 Vibe Coding AI 應用開發競賽 - 簡報 PPTX 產生器 (聚焦產品、大字簡潔版)
風格：溫馨醫療路線 (Warm Healthcare Aesthetic)
特色：大字體、留白充足、少字多圖卡、完全聚焦現有產品功能
"""

import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# -----------------------------------------------------------------------------
# 色彩定義 (溫馨醫療風格)
# -----------------------------------------------------------------------------
COLOR_BG = RGBColor(250, 248, 244)              # 暖米白底色 #FAF8F4
COLOR_CARD_BG = RGBColor(255, 255, 255)         # 卡片白 #FFFFFF
COLOR_CARD_BORDER = RGBColor(226, 218, 208)     # 卡片外框 #E2DAD0
COLOR_CARD_MUTED = RGBColor(245, 241, 235)      # 次級卡片淡灰米 #F5F1EB

COLOR_PRIMARY = RGBColor(38, 88, 92)            # 深暖青綠 #26585C
COLOR_PRIMARY_LIGHT = RGBColor(232, 242, 242)   # 青綠淡底
COLOR_SECONDARY = RGBColor(186, 88, 62)         # 暖陶土紅 #BA583E
COLOR_SECONDARY_LIGHT = RGBColor(248, 236, 232) # 陶土淡底
COLOR_ACCENT = RGBColor(82, 108, 120)           # 暖灰藍 #526C78

COLOR_TEXT_MAIN = RGBColor(34, 40, 44)          # 深炭灰 #22282C
COLOR_TEXT_MUTED = RGBColor(100, 108, 114)      # 次要說明灰 #646C72

FONT_FAMILY = "Microsoft JhengHei"

def set_slide_background(slide, color):
    background = slide.background
    fill = background.fill
    fill.solid()
    fill.fore_color.rgb = color

def add_header(slide, title_text, category_tag="第一屆 Vibe Coding AI 應用開發競賽", subtitle_text=""):
    """標準投影片頂部標題（大字、清晰）"""
    # 頂部分類小標
    tag_box = slide.shapes.add_textbox(Inches(0.9), Inches(0.4), Inches(11.5), Inches(0.35))
    tf_tag = tag_box.text_frame
    tf_tag.word_wrap = True
    tf_tag.margin_left = tf_tag.margin_top = tf_tag.margin_right = tf_tag.margin_bottom = 0
    p_tag = tf_tag.paragraphs[0]
    p_tag.text = category_tag.upper()
    p_tag.font.name = FONT_FAMILY
    p_tag.font.size = Pt(13)
    p_tag.font.bold = True
    p_tag.font.color.rgb = COLOR_SECONDARY

    # 主標題 (大字 26pt)
    title_box = slide.shapes.add_textbox(Inches(0.9), Inches(0.75), Inches(11.5), Inches(0.65))
    tf_title = title_box.text_frame
    tf_title.word_wrap = True
    tf_title.margin_left = tf_title.margin_top = tf_title.margin_right = tf_title.margin_bottom = 0
    p_title = tf_title.paragraphs[0]
    p_title.text = title_text
    p_title.font.name = FONT_FAMILY
    p_title.font.size = Pt(26)
    p_title.font.bold = True
    p_title.font.color.rgb = COLOR_PRIMARY

    # 次標題說明 (14pt)
    if subtitle_text:
        sub_box = slide.shapes.add_textbox(Inches(0.9), Inches(1.45), Inches(11.5), Inches(0.4))
        tf_sub = sub_box.text_frame
        tf_sub.word_wrap = True
        tf_sub.margin_left = tf_sub.margin_top = tf_sub.margin_right = tf_sub.margin_bottom = 0
        p_sub = tf_sub.paragraphs[0]
        p_sub.text = subtitle_text
        p_sub.font.name = FONT_FAMILY
        p_sub.font.size = Pt(14)
        p_sub.font.color.rgb = COLOR_TEXT_MUTED

def add_card(slide, left, top, width, height, bg_color=COLOR_CARD_BG, border_color=COLOR_CARD_BORDER):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = bg_color
    if border_color:
        shape.line.color.rgb = border_color
        shape.line.width = Pt(1.5)
    else:
        shape.line.fill.background()
    return shape

def create_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)  # 16:9
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # =========================================================================
    # Slide 1: 封面頁 (簡約、大字、聚焦)
    # =========================================================================
    slide1 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide1, COLOR_BG)

    add_card(slide1, Inches(1.0), Inches(0.9), Inches(11.333), Inches(5.7), COLOR_CARD_BG, COLOR_CARD_BORDER)

    tb = slide1.shapes.add_textbox(Inches(1.6), Inches(1.5), Inches(10.1), Inches(0.4))
    p = tb.text_frame.paragraphs[0]
    p.text = "第一屆 Vibe Coding AI 應用開發競賽 ‧ 臨床應用組"
    p.font.name = FONT_FAMILY
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = COLOR_SECONDARY

    tb_title = slide1.shapes.add_textbox(Inches(1.6), Inches(2.0), Inches(10.1), Inches(1.6))
    tf_t = tb_title.text_frame
    tf_t.word_wrap = True
    p_t = tf_t.paragraphs[0]
    p_t.text = "姿勢性低血壓 (OH) 測量語音指導\n與臨床記錄系統"
    p_t.font.name = FONT_FAMILY
    p_t.font.size = Pt(32)
    p_t.font.bold = True
    p_t.font.color.rgb = COLOR_PRIMARY

    p_sub = tf_t.add_paragraph()
    p_sub.text = "台灣國語／台語雙語臨床版"
    p_sub.font.name = FONT_FAMILY
    p_sub.font.size = Pt(20)
    p_sub.font.color.rgb = COLOR_SECONDARY
    p_sub.space_before = Pt(8)

    # 3 個重點大標籤
    tag_items = [
        "🗣️ 國台雙軌分流語音",
        "⏱️ 指引標準階梯計時",
        "📋 自動判讀與一鍵病歷"
    ]
    tw = Inches(3.1)
    tgap = Inches(0.4)
    tstart = Inches(1.6)
    for i, item in enumerate(tag_items):
        tx = tstart + i * (tw + tgap)
        add_card(slide1, tx, Inches(4.3), tw, Inches(0.9), COLOR_CARD_MUTED, None)
        box = slide1.shapes.add_textbox(tx, Inches(4.55), tw, Inches(0.5))
        tf = box.text_frame
        p = tf.paragraphs[0]
        p.text = item
        p.font.name = FONT_FAMILY
        p.font.size = Pt(15)
        p.font.bold = True
        p.font.color.rgb = COLOR_PRIMARY
        p.alignment = PP_ALIGN.CENTER

    tb_f = slide1.shapes.add_textbox(Inches(1.6), Inches(5.6), Inches(10.1), Inches(0.5))
    pf = tb_f.text_frame.paragraphs[0]
    pf.text = "報告人：院內參賽同仁　|　8 分鐘簡報及實機演示 ＋ 4 分鐘提問"
    pf.font.name = FONT_FAMILY
    pf.font.size = Pt(13)
    pf.font.color.rgb = COLOR_TEXT_MUTED

    # =========================================================================
    # Slide 2: 臨床問題與開發動機 (3張大字卡片，少字有感)
    # =========================================================================
    slide2 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide2, COLOR_BG)
    add_header(slide2, "臨床實務難題：為什麼需要這套工具？", "開發動機", "高齡長者跌倒防制是病安核心，但現行姿勢性低血壓量測常受限於臨床環境。")

    pains = [
        ("01", "時程被動縮水", "計時中斷致偽陰性", "國際指引規範平躺 5 分鐘、站立 3 分鐘。臨床護理極忙碌，計時常被呼叫打斷，縮水測量導致低血壓漏診。"),
        ("02", "高齡語言隔閡", "聽不懂國語引發焦慮", "長輩多慣用台語，聽不懂國語指令時緊張不知所措。交感神經亢奮導致血壓假性上升（白袍效應）。"),
        ("03", "人工計算繁重", "心算費時且易筆誤", "量測後需手動心算收縮壓、舒張壓差值與代償心率，再回溯謄打至 HIS 護理紀錄，耗時且易有人為失誤。")
    ]

    card_w = Inches(3.64)
    gap = Inches(0.39)
    for i, (num, title, subtitle, desc) in enumerate(pains):
        x = Inches(0.9) + i * (card_w + gap)
        add_card(slide2, x, Inches(2.1), card_w, Inches(4.7))
        box = slide2.shapes.add_textbox(x + Inches(0.3), Inches(2.4), card_w - Inches(0.6), Inches(4.1))
        tf = box.text_frame
        tf.word_wrap = True

        p_num = tf.paragraphs[0]
        p_num.text = num
        p_num.font.name = FONT_FAMILY
        p_num.font.size = Pt(28)
        p_num.font.bold = True
        p_num.font.color.rgb = COLOR_SECONDARY

        p_t = tf.add_paragraph()
        p_t.text = title
        p_t.font.name = FONT_FAMILY
        p_t.font.size = Pt(18)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_PRIMARY
        p_t.space_before = Pt(4)

        p_sub = tf.add_paragraph()
        p_sub.text = subtitle
        p_sub.font.name = FONT_FAMILY
        p_sub.font.size = Pt(13)
        p_sub.font.color.rgb = COLOR_SECONDARY
        p_sub.space_before = Pt(2)

        p_d = tf.add_paragraph()
        p_d.text = desc
        p_d.font.name = FONT_FAMILY
        p_d.font.size = Pt(13)
        p_d.font.color.rgb = COLOR_TEXT_MAIN
        p_d.space_before = Pt(14)

    # =========================================================================
    # Slide 3: 產品核心定位與三本柱 (聚焦現有系統)
    # =========================================================================
    slide3 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide3, COLOR_BG)
    add_header(slide3, "產品核心定位：臨床第一線的「雙語智慧副駕駛」", "產品設計", "針對第一線護理師量身打造，將繁瑣的量測轉化為標準化、防呆的數位工作流。")

    pillars = [
        ("柱一：雙軌語音分流", "消除白袍焦慮", [
            "病患聽台語：親切母語引導動作與放鬆",
            "醫護聽國語：精確提醒流程與量測準備",
            "內建 400% 音量增強，重聽長輩清楚聽懂"
        ]),
        ("柱二：標準防呆計時", "落實 AAS/EFAS 指引", [
            "階梯倒數：平躺 5 分 ➔ 站立 1 分 ➔ 站立 3 分",
            "背景舒緩輕音樂：放鬆身心穩定血壓",
            "⚡ 15 秒快速展示模式：專供競賽與培訓"
        ]),
        ("柱三：自動判讀與對接", "零手算 ‧ 零謄打", [
            "即時運算：ΔSBP、ΔDBP 達標自動標紅",
            "鑑別輔助：心率代償與神經源性 (nOH) 提醒",
            "一鍵複製：3 秒貼入 HIS 標準護理紀錄"
        ])
    ]

    for i, (title, sub, bullets) in enumerate(pillars):
        x = Inches(0.9) + i * (card_w + gap)
        add_card(slide3, x, Inches(2.1), card_w, Inches(4.7))
        box = slide3.shapes.add_textbox(x + Inches(0.3), Inches(2.4), card_w - Inches(0.6), Inches(4.1))
        tf = box.text_frame
        tf.word_wrap = True

        p_t = tf.paragraphs[0]
        p_t.text = title
        p_t.font.name = FONT_FAMILY
        p_t.font.size = Pt(18)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_PRIMARY

        p_sub = tf.add_paragraph()
        p_sub.text = sub
        p_sub.font.name = FONT_FAMILY
        p_sub.font.size = Pt(13)
        p_sub.font.color.rgb = COLOR_SECONDARY
        p_sub.space_before = Pt(2)

        for b in bullets:
            p_b = tf.add_paragraph()
            p_b.text = f"• {b}"
            p_b.font.name = FONT_FAMILY
            p_b.font.size = Pt(13)
            p_b.font.color.rgb = COLOR_TEXT_MAIN
            p_b.space_before = Pt(12)

    # =========================================================================
    # Slide 4: 現有產品功能一：雙軌語音與音樂計時 (聚焦現有介面)
    # =========================================================================
    slide4 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide4, COLOR_BG)
    add_header(slide4, "核心功能一：國台雙軌語音 ＆ 階梯音樂計時", "產品功能聚焦", "已完整實作於現有系統，提供長者親切體驗與護理人員標準化流程輔助。")

    # 左右兩大卡片 (字大、排版清爽)
    half_w = Inches(5.6)
    add_card(slide4, Inches(0.9), Inches(2.1), half_w, Inches(4.7))
    box_l = slide4.shapes.add_textbox(Inches(1.2), Inches(2.4), half_w - Inches(0.6), Inches(4.1))
    tf_l = box_l.text_frame
    tf_l.word_wrap = True

    p = tf_l.paragraphs[0]
    p.text = "🗣️ 國台雙軌語音系統"
    p.font.name = FONT_FAMILY
    p.font.size = Pt(20)
    p.font.bold = True
    p.font.color.rgb = COLOR_PRIMARY

    v_points = [
        ("病患聽台語、醫護聽國語", "長輩聽道地母語放鬆安心，醫護聽國語精確時程提醒，醫病雙向無障礙。"),
        ("四種語言模式自由切換", "支援「推薦模式、全台語、長者雙語、全國語」，彈性配合各病房臨床習慣。"),
        ("獨家 400% 音量增強技術", "運用 Web Audio API GainNode 增益，即便推車喇叭老舊，重聽長者依然聽得清。")
    ]
    for title, desc in v_points:
        p_t = tf_l.add_paragraph()
        p_t.text = f"• {title}"
        p_t.font.name = FONT_FAMILY
        p_t.font.size = Pt(14.5)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_TEXT_MAIN
        p_t.space_before = Pt(12)
        p_d = tf_l.add_paragraph()
        p_d.text = f"   {desc}"
        p_d.font.name = FONT_FAMILY
        p_d.font.size = Pt(12.5)
        p_d.font.color.rgb = COLOR_TEXT_MUTED

    add_card(slide4, Inches(6.833), Inches(2.1), half_w, Inches(4.7))
    box_r = slide4.shapes.add_textbox(Inches(7.133), Inches(2.4), half_w - Inches(0.6), Inches(4.1))
    tf_r = box_r.text_frame
    tf_r.word_wrap = True

    p = tf_r.paragraphs[0]
    p.text = "⏱️ 指引階梯計時與放鬆音訊"
    p.font.name = FONT_FAMILY
    p.font.size = Pt(20)
    p.font.bold = True
    p.font.color.rgb = COLOR_SECONDARY

    t_points = [
        ("標準時程自動防呆推進", "平躺 5 分鐘靜息 ➔ 站立 1 分鐘量測 ➔ 站立 3 分鐘量測（可選坐姿過渡）。"),
        ("432Hz 舒緩輕音樂合成", "代碼原生合成放鬆音律，等待時間不焦慮，量測前 15 秒語音主動預警。"),
        ("⚡ 15 秒快速展示模式", "一鍵切換預覽模式，全流程等比例縮短為 15 秒，極速驗證、培訓與演示。")
    ]
    for title, desc in t_points:
        p_t = tf_r.add_paragraph()
        p_t.text = f"• {title}"
        p_t.font.name = FONT_FAMILY
        p_t.font.size = Pt(14.5)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_TEXT_MAIN
        p_t.space_before = Pt(12)
        p_d = tf_r.add_paragraph()
        p_d.text = f"   {desc}"
        p_d.font.name = FONT_FAMILY
        p_d.font.size = Pt(12.5)
        p_d.font.color.rgb = COLOR_TEXT_MUTED

    # =========================================================================
    # Slide 5: 現有產品功能二：即時差值計算與臨床輔助 (聚焦現有臨床邏輯)
    # =========================================================================
    slide5 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide5, COLOR_BG)
    add_header(slide5, "核心功能二：即時差值計算 ＆ 臨床輔助決策", "產品功能聚焦", "系統內建完整 AAS/EFAS 國際指引判讀邏輯，鍵入數值即刻完成運算與風險警示。")

    c_cards = [
        ("收縮壓 / 舒張壓自動算差", "達標立即標紅警示", [
            "自動計算 ΔSBP 與 ΔDBP 差值。",
            "收縮壓下降 ≥ 20 或 舒張壓下降 ≥ 10 mmHg，系統即刻紅字標記陽性達標。",
            "免除護理同仁臨床心算負擔，杜絕筆誤。"
        ]),
        ("自律神經代償反應分析", "輔助鑑別神經源性 (nOH)", [
            "自動比對血壓驟降時之心率變化 (ΔHR)。",
            "若心率增加 < 15 bpm，主動提示「代償鈍化，疑似神經源性姿勢性低血壓」。",
            "提供住院醫師與年輕同仁鑑別診斷重要依據。"
        ]),
        ("POTS 篩檢與安全中止機制", "保護病患防跌第一線", [
            "POTS 篩檢：血壓未降但心跳增加 ≥ 30 bpm 時，主動跳出心搏過速提醒。",
            "🚨 緊急中止按鈕：長輩突發不適，一鍵切換安撫語音「請趕緊坐下」，並記錄原因。"
        ])
    ]

    for i, (title, sub, bullets) in enumerate(c_cards):
        x = Inches(0.9) + i * (card_w + gap)
        add_card(slide5, x, Inches(2.1), card_w, Inches(4.7))
        box = slide5.shapes.add_textbox(x + Inches(0.3), Inches(2.4), card_w - Inches(0.6), Inches(4.1))
        tf = box.text_frame
        tf.word_wrap = True

        p_t = tf.paragraphs[0]
        p_t.text = title
        p_t.font.name = FONT_FAMILY
        p_t.font.size = Pt(17)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_PRIMARY

        p_sub = tf.add_paragraph()
        p_sub.text = sub
        p_sub.font.name = FONT_FAMILY
        p_sub.font.size = Pt(13)
        p_sub.font.color.rgb = COLOR_SECONDARY
        p_sub.space_before = Pt(2)

        for b in bullets:
            p_b = tf.add_paragraph()
            p_b.text = f"• {b}"
            p_b.font.name = FONT_FAMILY
            p_b.font.size = Pt(13)
            p_b.font.color.rgb = COLOR_TEXT_MAIN
            p_b.space_before = Pt(12)

    # =========================================================================
    # Slide 6: 現有產品功能三：一鍵病歷生成與歷史管理 (聚焦現有產出)
    # =========================================================================
    slide6 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide6, COLOR_BG)
    add_header(slide6, "核心功能三：一鍵 EMR 病歷複製 ＆ 歷史數據管理", "產品功能聚焦", "徹底打通最後一哩路：測量完畢一鍵帶入 HIS 系統，並支援科部統計匯出。")

    add_card(slide6, Inches(0.9), Inches(2.1), half_w, Inches(4.7))
    box_l6 = slide6.shapes.add_textbox(Inches(1.2), Inches(2.4), half_w - Inches(0.6), Inches(4.1))
    tf_l6 = box_l6.text_frame
    tf_l6.word_wrap = True

    p = tf_l6.paragraphs[0]
    p.text = "📋 一鍵 EMR 標準病歷摘要"
    p.font.name = FONT_FAMILY
    p.font.size = Pt(20)
    p.font.bold = True
    p.font.color.rgb = COLOR_PRIMARY

    emr_points = [
        ("3 秒完成護理病歷登錄", "點擊「一鍵複製臨床病歷摘要」，直接切換至院內 HIS/NIS 按 Ctrl+V 貼上，省去 3~5 分鐘手動繕打。"),
        ("格式結構嚴謹客觀", "自動整合受檢者資料、平躺基準、站立各階段血壓、心跳差值、症狀勾選及臨床判讀結論。"),
        ("零系統介接門檻", "無需等待院內資訊系統漫長改版，即開即貼、零排程阻礙。")
    ]
    for title, desc in emr_points:
        p_t = tf_l6.add_paragraph()
        p_t.text = f"• {title}"
        p_t.font.name = FONT_FAMILY
        p_t.font.size = Pt(14.5)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_TEXT_MAIN
        p_t.space_before = Pt(12)
        p_d = tf_l6.add_paragraph()
        p_d.text = f"   {desc}"
        p_d.font.name = FONT_FAMILY
        p_d.font.size = Pt(12.5)
        p_d.font.color.rgb = COLOR_TEXT_MUTED

    add_card(slide6, Inches(6.833), Inches(2.1), half_w, Inches(4.7))
    box_r6 = slide6.shapes.add_textbox(Inches(7.133), Inches(2.4), half_w - Inches(0.6), Inches(4.1))
    tf_r6 = box_r6.text_frame
    tf_r6.word_wrap = True

    p = tf_r6.paragraphs[0]
    p.text = "🗂️ 本機歷史紀錄與 CSV 匯出"
    p.font.name = FONT_FAMILY
    p.font.size = Pt(20)
    p.font.bold = True
    p.font.color.rgb = COLOR_SECONDARY

    hist_points = [
        ("完整紀錄隨時回溯重播", "系統本機自動儲存歷史測量列表，護理師與醫師可隨時點選單筆調閱原始壓差曲線。"),
        ("支援結構化 CSV 批次匯出", "一鍵匯出全院或科部檢測數據，支援品管圈 (QCC)、跌倒防制專案與臨床醫學研究。"),
        ("安全本機儲存機制", "儲存於瀏覽器 LocalStorage，醫護可隨時一鍵清空，自主掌控資料生命週期。")
    ]
    for title, desc in hist_points:
        p_t = tf_r6.add_paragraph()
        p_t.text = f"• {title}"
        p_t.font.name = FONT_FAMILY
        p_t.font.size = Pt(14.5)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_TEXT_MAIN
        p_t.space_before = Pt(12)
        p_d = tf_r6.add_paragraph()
        p_d.text = f"   {desc}"
        p_d.font.name = FONT_FAMILY
        p_d.font.size = Pt(12.5)
        p_d.font.color.rgb = COLOR_TEXT_MUTED

    # =========================================================================
    # Slide 7: 系統架構：純前端、零資安負擔 (聚焦目前技術實作)
    # =========================================================================
    slide7 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide7, COLOR_BG)
    add_header(slide7, "系統架構特色：純前端 ＆ 零資安負擔", "技術架構與合規", "極簡架構設計，確保在醫療機構內零安裝阻力、零維護成本、零資安外洩疑慮。")

    arch_cards = [
        ("極輕量純前端架構 (SPA)", "秒開秒用 ‧ 零依賴", [
            "HTML5 + Vanilla Modern JS，總體積小於 1.5MB。",
            "老舊護理推車 0.1 秒秒開，操作反應零延遲。",
            "Web Audio API 純代碼合成音樂，無外部版權問題。"
        ]),
        ("100% 本地運算合規", "零雲端上傳 ‧ 保障隱私", [
            "無任何外部伺服器連線，絕不上傳病患資料至公有雲。",
            "病歷號與生理數據全程留存於本機記憶體，完全符合個人資料保護法與醫療資安規範。"
        ]),
        ("完全支援離線作業", "斷網依然照常運作", [
            "不依賴外網連線，即便病房 Wi-Fi 訊號不穩，所有計時、台語發音與判讀完全不受影響。",
            "資訊室零主機維護負擔、零對外通訊埠風險。"
        ])
    ]

    for i, (title, sub, bullets) in enumerate(arch_cards):
        x = Inches(0.9) + i * (card_w + gap)
        add_card(slide7, x, Inches(2.1), card_w, Inches(4.7))
        box = slide7.shapes.add_textbox(x + Inches(0.3), Inches(2.4), card_w - Inches(0.6), Inches(4.1))
        tf = box.text_frame
        tf.word_wrap = True

        p_t = tf.paragraphs[0]
        p_t.text = title
        p_t.font.name = FONT_FAMILY
        p_t.font.size = Pt(17)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_PRIMARY

        p_sub = tf.add_paragraph()
        p_sub.text = sub
        p_sub.font.name = FONT_FAMILY
        p_sub.font.size = Pt(13)
        p_sub.font.color.rgb = COLOR_SECONDARY
        p_sub.space_before = Pt(2)

        for b in bullets:
            p_b = tf.add_paragraph()
            p_b.text = f"• {b}"
            p_b.font.name = FONT_FAMILY
            p_b.font.size = Pt(13)
            p_b.font.color.rgb = COLOR_TEXT_MAIN
            p_b.space_before = Pt(12)

    # =========================================================================
    # Slide 8: 現場實機演示導引 (大字步驟引導，準備切換網頁)
    # =========================================================================
    slide8 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide8, COLOR_BG)
    add_header(slide8, "現場實機功能演示 (Live Demo)", "實機展示", "以下將切換至真實系統操作，於 2 分半鐘內完整演示臨床測量全流程。")

    steps = [
        ("01", "開啟展示模式", "勾選「⚡ 15 秒快速展示模式」，試聽道地親切台語播報。"),
        ("02", "平躺靜臥計時", "聆聽純代碼合成舒緩輕音樂，示範倒數 15 秒前置語音預警。"),
        ("03", "站立量測算差", "鍵入平躺與站立 1 分鐘數值，即時標紅顯示收縮壓下降（如降 26 mmHg）。"),
        ("04", "綜合判讀提示", "勾選臨床症狀，系統自動警示【陽性】並跳出【心率代償不足 / 神經源性提示】。"),
        ("05", "一鍵 EMR 複製", "點擊「複製臨床病歷摘要」，現場貼至記事本展示 3 秒登錄效果。")
    ]

    sw = Inches(2.15)
    sgap = Inches(0.18)
    for i, (num, title, desc) in enumerate(steps):
        x = Inches(0.9) + i * (sw + sgap)
        add_card(slide8, x, Inches(2.1), sw, Inches(4.7))
        box = slide8.shapes.add_textbox(x + Inches(0.2), Inches(2.4), sw - Inches(0.4), Inches(4.1))
        tf = box.text_frame
        tf.word_wrap = True

        p_num = tf.paragraphs[0]
        p_num.text = num
        p_num.font.name = FONT_FAMILY
        p_num.font.size = Pt(28)
        p_num.font.bold = True
        p_num.font.color.rgb = COLOR_SECONDARY

        p_t = tf.add_paragraph()
        p_t.text = title
        p_t.font.name = FONT_FAMILY
        p_t.font.size = Pt(16)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_PRIMARY
        p_t.space_before = Pt(4)

        p_d = tf.add_paragraph()
        p_d.text = desc
        p_d.font.name = FONT_FAMILY
        p_d.font.size = Pt(12.5)
        p_d.font.color.rgb = COLOR_TEXT_MAIN
        p_d.space_before = Pt(14)

    # =========================================================================
    # Slide 9: 實務應用效益 (超大 KPI 數字，簡潔震撼)
    # =========================================================================
    slide9 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide9, COLOR_BG)
    add_header(slide9, "臨床實務效益：精確 ‧ 減負 ‧ 提升品質", "量化成效", "以真實數據說話，透過數位自動化帶來立竿見影的臨床品質提升。")

    kpi_cards = [
        ("50%", "量測總工時縮短", "由傳統 18 分鐘縮減至 9 分鐘，流程標準化不慌亂。"),
        ("0%", "差值計算錯誤率", "杜絕臨床人工心算與手抄筆誤，演算法精準計算各階段壓差。"),
        ("3 秒", "病歷登錄時間", "一鍵複製結構化格式貼入 HIS，省下 3~5 分鐘逐欄謄打時間。")
    ]

    for i, (num, label, desc) in enumerate(kpi_cards):
        x = Inches(0.9) + i * (card_w + gap)
        add_card(slide9, x, Inches(2.1), card_w, Inches(4.7))
        box = slide9.shapes.add_textbox(x + Inches(0.3), Inches(2.5), card_w - Inches(0.6), Inches(3.9))
        tf = box.text_frame
        tf.word_wrap = True

        p_num = tf.paragraphs[0]
        p_num.text = num
        p_num.font.name = FONT_FAMILY
        p_num.font.size = Pt(48)
        p_num.font.bold = True
        p_num.font.color.rgb = COLOR_SECONDARY

        p_lbl = tf.add_paragraph()
        p_lbl.text = label
        p_lbl.font.name = FONT_FAMILY
        p_lbl.font.size = Pt(18)
        p_lbl.font.bold = True
        p_lbl.font.color.rgb = COLOR_PRIMARY
        p_lbl.space_before = Pt(8)

        p_desc = tf.add_paragraph()
        p_desc.text = desc
        p_desc.font.name = FONT_FAMILY
        p_desc.font.size = Pt(14)
        p_desc.font.color.rgb = COLOR_TEXT_MAIN
        p_desc.space_before = Pt(16)

    # =========================================================================
    # Slide 10: 結語與提問 (簡約大器、溫馨結語)
    # =========================================================================
    slide10 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide10, COLOR_BG)

    add_card(slide10, Inches(1.0), Inches(0.9), Inches(11.333), Inches(5.7), COLOR_CARD_BG, COLOR_CARD_BORDER)

    tb = slide10.shapes.add_textbox(Inches(1.6), Inches(1.5), Inches(10.1), Inches(0.4))
    p = tb.text_frame.paragraphs[0]
    p.text = "結語 ‧ 務實科技 溫暖照護"
    p.font.name = FONT_FAMILY
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = COLOR_SECONDARY

    tb_main = slide10.shapes.add_textbox(Inches(1.6), Inches(2.0), Inches(10.1), Inches(1.2))
    p_m = tb_main.text_frame.paragraphs[0]
    p_m.text = "用懂長輩的語言，算最精確的指標"
    p_m.font.name = FONT_FAMILY
    p_m.font.size = Pt(30)
    p_m.font.bold = True
    p_m.font.color.rgb = COLOR_PRIMARY

    # 三大務實承諾
    conclusions = [
        ("落實標準指引", "時程防呆倒數，徹底杜絕臨床縮水量測。"),
        ("實質減輕負擔", "自動算差、心率鑑別、病歷一鍵貼入 HIS。"),
        ("守護長輩安全", "親切台語與放鬆音樂，守護站穩的每一步。")
    ]
    for i, (title, desc) in enumerate(conclusions):
        cx = tstart + i * (tw + tgap)
        add_card(slide10, cx, Inches(3.4), tw, Inches(1.6), COLOR_CARD_MUTED, None)
        box = slide10.shapes.add_textbox(cx + Inches(0.2), Inches(3.6), tw - Inches(0.4), Inches(1.2))
        tf_box = box.text_frame
        tf_box.word_wrap = True
        p_t = tf_box.paragraphs[0]
        p_t.text = title
        p_t.font.name = FONT_FAMILY
        p_t.font.size = Pt(16)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_PRIMARY
        p_d = tf_box.add_paragraph()
        p_d.text = desc
        p_d.font.name = FONT_FAMILY
        p_d.font.size = Pt(12.5)
        p_d.font.color.rgb = COLOR_TEXT_MUTED
        p_d.space_before = Pt(8)

    tb_qa = slide10.shapes.add_textbox(Inches(1.6), Inches(5.4), Inches(10.1), Inches(0.6))
    tf_qa = tb_qa.text_frame
    p_qa = tf_qa.paragraphs[0]
    p_qa.text = "感謝各位評審長官聆聽 ‧ 敬請指教與提問 (Q&A)"
    p_qa.font.name = FONT_FAMILY
    p_qa.font.size = Pt(17)
    p_qa.font.bold = True
    p_qa.font.color.rgb = COLOR_SECONDARY
    p_qa.alignment = PP_ALIGN.CENTER

    output_path = "姿勢性低血壓_臨床量測導引與紀錄系統_競賽簡報.pptx"
    prs.save(output_path)
    print(f"Presentation saved successfully to: {os.path.abspath(output_path)}")

if __name__ == "__main__":
    create_presentation()
