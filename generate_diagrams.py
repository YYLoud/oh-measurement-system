#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
產生高解析度「圖 1 操作流程」與「圖 2 部署架構」流程圖圖片
供 Word (.docx) 與 HTML 規格書直接嵌入
"""

import math
from PIL import Image, ImageDraw, ImageFont

FONT_PATH_REG = "C:/Windows/Fonts/msjh.ttc"
FONT_PATH_BOLD = "C:/Windows/Fonts/msjhbd.ttc"

def draw_arrow(draw, start, end, color=(74, 85, 104), width=4, arrow_size=16):
    """繪製帶有三角形箭頭的平滑線段"""
    x1, y1 = start
    x2, y2 = end
    draw.line([start, end], fill=color, width=width)
    
    # 計算角度
    angle = math.atan2(y2 - y1, x2 - x1)
    # 箭頭兩側頂點
    p1 = (x2 - arrow_size * math.cos(angle - math.pi / 6),
          y2 - arrow_size * math.sin(angle - math.pi / 6))
    p2 = (x2 - arrow_size * math.cos(angle + math.pi / 6),
          y2 - arrow_size * math.sin(angle + math.pi / 6))
    draw.polygon([end, p1, p2], fill=color)

def draw_rounded_card(draw, xy, radius=16, fill=(255, 255, 255), outline=(203, 213, 224), width=2):
    """繪製圓角卡片"""
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)

def generate_flowchart_1():
    # 畫布尺寸 (2400 x 1200, 適合插入 A4 Word 頁寬)
    w, h = 2400, 1150
    img = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)

    # 字型
    f_title = ImageFont.truetype(FONT_PATH_BOLD, 32)
    f_role = ImageFont.truetype(FONT_PATH_REG, 24)
    f_badge = ImageFont.truetype(FONT_PATH_BOLD, 22)
    f_label = ImageFont.truetype(FONT_PATH_BOLD, 24)

    # 外框大卡片容器 (柔和淺灰底)
    draw_rounded_card(draw, [40, 30, w - 40, h - 30], radius=24, fill=(248, 250, 252), outline=(226, 232, 240), width=3)

    # 階段 1：平躺準備階段 (Row 1: 4 個節點)
    # 節點尺寸
    bw, bh = 430, 140
    y1 = 140
    xs = [100, 680, 1260, 1840]

    row1_steps = [
        ("F01 病患建檔", "操作：護理師", (235, 248, 255), (49, 130, 206), (26, 54, 93)),
        ("F02 語音設定", "操作：護理師", (235, 248, 255), (49, 130, 206), (26, 54, 93)),
        ("F03 平躺靜息", "操作：護理師 / 病患", (240, 253, 250), (13, 148, 136), (19, 78, 74)),
        ("F04 平躺量測", "操作：護理師", (240, 253, 250), (13, 148, 136), (19, 78, 74))
    ]

    for i, (title, role, bg_col, border_col, text_col) in enumerate(row1_steps):
        x = xs[i]
        # 卡片
        draw_rounded_card(draw, [x, y1, x + bw, y1 + bh], radius=18, fill=bg_col, outline=border_col, width=3)
        # 標題
        draw.text((x + bw // 2, y1 + 45), title, fill=text_col, font=f_title, anchor="mm")
        # 角色說明
        draw.text((x + bw // 2, y1 + 95), role, fill=(74, 85, 104), font=f_role, anchor="mm")

        # 箭頭 (前三個節點水平連線)
        if i < 3:
            draw_arrow(draw, (x + bw + 10, y1 + bh // 2), (xs[i+1] - 15, y1 + bh // 2), color=(74, 85, 104), width=4, arrow_size=16)

    # 從 Row 1 轉折到 Row 2 的連接線 (從 F04 右側折向下再折向左進入 F05)
    # F04 center-right: (1840 + 430 = 2270, y1 + bh//2 = 210)
    # Row 2 y2 = 460
    # 箭頭從 (2055, 280) 向下，再平移到 Row 2
    # 簡化轉折：從 F04 底部向下一段，折向左到 F05 頂部
    # 或 Row 2 放置於 y2 = 480:
    y2 = 460
    # Row 2 steps: Left to Right
    row2_steps = [
        ("F05 站立 1 分", "操作：護理師 / 病患", (255, 251, 235), (217, 119, 6), (120, 53, 15)),
        ("F06 站立 3 分", "操作：護理師 / 病患", (255, 251, 235), (217, 119, 6), (120, 53, 15)),
        ("F07 自動判讀", "操作：系統演算法", (243, 232, 255), (147, 51, 234), (88, 28, 135)),
        ("F08 病歷複製", "操作：護理師", (236, 253, 245), (16, 185, 129), (6, 95, 70))
    ]

    for i, (title, role, bg_col, border_col, text_col) in enumerate(row2_steps):
        x = xs[i]
        draw_rounded_card(draw, [x, y2, x + bw, y2 + bh], radius=18, fill=bg_col, outline=border_col, width=3)
        draw.text((x + bw // 2, y2 + 45), title, fill=text_col, font=f_title, anchor="mm")
        draw.text((x + bw // 2, y2 + 95), role, fill=(74, 85, 104), font=f_role, anchor="mm")

        if i < 3:
            draw_arrow(draw, (x + bw + 10, y2 + bh // 2), (xs[i+1] - 15, y2 + bh // 2), color=(74, 85, 104), width=4, arrow_size=16)

    # 跨行轉折線：F04 (右下角) ➔ F05 (左上角)
    # 線條路徑：(2055, y1 + bh) ➔ (2055, 380) ➔ (315, 380) ➔ (315, y2 - 10)
    p_start = (xs[3] + bw // 2, y1 + bh)
    p_corner1 = (xs[3] + bw // 2, 360)
    p_corner2 = (xs[0] + bw // 2, 360)
    p_end = (xs[0] + bw // 2, y2 - 15)

    draw.line([p_start, p_corner1, p_corner2, (p_end[0], p_corner2[1])], fill=(74, 85, 104), width=4)
    draw_arrow(draw, (p_end[0], p_corner2[1]), p_end, color=(74, 85, 104), width=4, arrow_size=16)
    draw.text(((p_corner1[0] + p_corner2[0]) // 2, 340), "平躺基準完成，引導起立", fill=(74, 85, 104), font=f_label, anchor="mb")

    # 緊急中止分支：Row 3 (F09 緊急中止)
    y3 = 800
    w_abort = 640
    h_abort = 160
    x_abort = (w - w_abort) // 2

    # 紅色警戒卡片
    draw_rounded_card(draw, [x_abort, y3, x_abort + w_abort, y3 + h_abort], radius=20, fill=(254, 242, 242), outline=(239, 68, 68), width=3)
    draw.text((x_abort + w_abort // 2, y3 + 55), "🚨 F09 緊急中止安全保護", fill=(153, 27, 27), font=f_title, anchor="mm")
    draw.text((x_abort + w_abort // 2, y3 + 105), "操作：護理師 / 病患（即刻語音引導坐下）", fill=(185, 28, 28), font=f_role, anchor="mm")

    # 從 F05 底部與 F06 底部連向 F09 的折線
    # F05 bottom center
    p_f05_bot = (xs[0] + bw // 2, y2 + bh)
    # F06 bottom center
    p_f06_bot = (xs[1] + bw // 2, y2 + bh)
    mid_y = 700

    # F05 line
    draw.line([p_f05_bot, (p_f05_bot[0], mid_y), (x_abort + w_abort // 2, mid_y)], fill=(220, 38, 38), width=3)
    # F06 line
    draw.line([p_f06_bot, (p_f06_bot[0], mid_y)], fill=(220, 38, 38), width=3)
    # arrow to F09
    draw_arrow(draw, (x_abort + w_abort // 2, mid_y), (x_abort + w_abort // 2, y3 - 15), color=(220, 38, 38), width=3, arrow_size=16)

    # 標籤「突發暈眩 / 眼前發黑 / 不耐站立」
    draw.text((x_abort + w_abort // 2, mid_y - 25), "若出現突發暈眩、眼前發黑或步態不穩", fill=(220, 38, 38), font=f_label, anchor="mb")

    # 階段分區徽章文字
    draw.text((100, 95), "【第一階段：平躺靜息與基準測量】", fill=(43, 108, 176), font=f_badge, anchor="ls")
    draw.text((100, 415), "【第二階段：站立測量與臨床判讀】", fill=(180, 83, 9), font=f_badge, anchor="ls")
    draw.text((x_abort, 755), "【安全保護機制】", fill=(185, 28, 28), font=f_badge, anchor="ls")

    out_file = "flowchart_f1.png"
    img.save(out_file, dpi=(300, 300))
    print(f"Generated {out_file} successfully.")

def generate_architecture_2():
    # 畫布尺寸 (2400 x 1400)
    w, h = 2400, 1380
    img = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)

    f_title = ImageFont.truetype(FONT_PATH_BOLD, 30)
    f_body = ImageFont.truetype(FONT_PATH_REG, 23)
    f_badge = ImageFont.truetype(FONT_PATH_BOLD, 26)
    f_header = ImageFont.truetype(FONT_PATH_BOLD, 34)

    # 外框大容器
    draw_rounded_card(draw, [40, 30, w - 40, h - 30], radius=24, fill=(248, 250, 252), outline=(226, 232, 240), width=3)

    # 頂部大標籤：使用者終端設備 (推車電腦 / 平板瀏覽器)
    top_w = w - 160
    draw_rounded_card(draw, [80, 70, 80 + top_w, 220], radius=18, fill=(235, 248, 255), outline=(49, 130, 206), width=3)
    draw.text((w // 2, 115), "💻 第一線使用者終端設備（護理推車電腦 ／ 平板電腦瀏覽器）", fill=(26, 54, 93), font=f_header, anchor="mm")
    draw.text((w // 2, 175), "免安裝任何軟體 ‧ 點擊書籤即開即用 ‧ 支援離線斷網作業", fill=(43, 108, 176), font=f_body, anchor="mm")

    # 下方 4 大核心模組卡片 (2x2 Grid)
    # y = 300, y = 820
    # Left x = 80, Right x = 1240
    mw = 1080
    mh = 480
    y_m1 = 300
    y_m2 = 820

    # 模組 1：前端介面與流程狀態機 (Top-Left)
    draw_rounded_card(draw, [80, y_m1, 80 + mw, y_m1 + mh], radius=18, fill=(255, 255, 255), outline=(203, 213, 224), width=2)
    draw.text((120, y_m1 + 50), "📱 前端介面與流程狀態機 (Protocol & UI)", fill=(43, 108, 176), font=f_badge, anchor="ls")
    p1_items = [
        "• 雙欄連動工作區：左側語音時程面板 ＋ 右側臨床記錄面板",
        "• 流程狀態機 (protocol-steps.js)：平躺 5 分 ➔ 站立 1/3 分階梯推進",
        "• 倒數計時引擎：微秒級防呆計時，倒數 15 秒前置語音預警",
        "• ⚡ 15 秒快速展示模式：縮短等待時程，便利臨床教學與競賽演示",
        "• 本地端即時校驗：自動限制無效操作，防止重覆點擊與漏測"
    ]
    for i, item in enumerate(p1_items):
        draw.text((120, y_m1 + 115 + i * 65), item, fill=(51, 65, 85), font=f_body)

    # 模組 2：臨床決策與判讀引擎 (Top-Right)
    draw_rounded_card(draw, [1240, y_m1, 1240 + mw, y_m1 + mh], radius=18, fill=(255, 255, 255), outline=(203, 213, 224), width=2)
    draw.text((1280, y_m1 + 50), "🧠 臨床決策與智慧判讀引擎 (Clinical Evaluator)", fill=(147, 51, 234), font=f_badge, anchor="ls")
    p2_items = [
        "• AAS / EFAS 國際指引標準：自動計算 ΔSBP 與 ΔDBP 壓差",
        "• 陽性即時標記：收縮壓降 ≥20 或舒張壓降 ≥10 mmHg 即刻紅字警示",
        "• 神經源性 (nOH) 代償分析：心跳增加 <15 bpm 提示自主神經病變",
        "• 姿勢性心搏過速 (POTS) 篩檢：心率增幅 ≥30 bpm 主動提示",
        "• 仰臥位高血壓與多重症狀整合矩陣：輔助醫師精準鑑別診斷"
    ]
    for i, item in enumerate(p2_items):
        draw.text((1280, y_m1 + 115 + i * 65), item, fill=(51, 65, 85), font=f_body)

    # 模組 3：雙軌音訊子系統 (Bottom-Left)
    draw_rounded_card(draw, [80, y_m2, 80 + mw, y_m2 + mh], radius=18, fill=(255, 255, 255), outline=(203, 213, 224), width=2)
    draw.text((120, y_m2 + 50), "🎙️ 國台雙軌音訊子系統 (Audio Subsystem)", fill=(13, 148, 136), font=f_badge, anchor="ls")
    p3_items = [
        "• 台語音訊資產池：內建高擬真 MP3 / Base64 音訊，台語親切道地",
        "• 台灣國語語音合成：調用 W3C Web Speech API 進行精確醫護提示",
        "• 400% 音量增強 (GainNode)：Web Audio 增益節點，專為重聽長者設計",
        "• 432Hz 安定輕音樂合成：純程式碼原生振盪器合成，平靜病患情緒",
        "• 四種語言彈性切換：推薦模式／全台語／長者雙語／全國語"
    ]
    for i, item in enumerate(p3_items):
        draw.text((120, y_m2 + 115 + i * 65), item, fill=(51, 65, 85), font=f_body)

    # 模組 4：數據持久與病歷輸出 (Bottom-Right)
    draw_rounded_card(draw, [1240, y_m2, 1240 + mw, y_m2 + mh], radius=18, fill=(255, 255, 255), outline=(203, 213, 224), width=2)
    draw.text((1280, y_m2 + 50), "📋 數據持久與 EMR 病歷輸出 (Data & Export)", fill=(217, 119, 6), font=f_badge, anchor="ls")
    p4_items = [
        "• 一鍵 EMR 結構化病歷：3 秒複製文字直接貼回 HIS/NIS 護理紀錄",
        "• 零雲端依賴 (Zero Network Footprint)：不連外網、個資不外洩",
        "• 本機安全存儲：瀏覽器 LocalStorage 持久化，醫護可自主清空",
        "• CSV / JSON 批次匯出：支援品管圈 (QCC) 與臨床跌倒防制統計",
        "• 符合資安合規：完全符合醫療機構個資法與資安防護規範"
    ]
    for i, item in enumerate(p4_items):
        draw.text((1280, y_m2 + 115 + i * 65), item, fill=(51, 65, 85), font=f_body)

    # 頂部與下方模組的向下連線
    draw_arrow(draw, (w // 2 - 250, 225), (w // 2 - 250, y_m1 - 10), color=(49, 130, 206), width=4, arrow_size=16)
    draw_arrow(draw, (w // 2 + 250, 225), (w // 2 + 250, y_m1 - 10), color=(49, 130, 206), width=4, arrow_size=16)

    out_file = "architecture_f2.png"
    img.save(out_file, dpi=(300, 300))
    print(f"Generated {out_file} successfully.")

if __name__ == "__main__":
    generate_flowchart_1()
    generate_architecture_2()
