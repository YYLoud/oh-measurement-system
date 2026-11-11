import zipfile
import html
import os

def create_docx(target_filename):
    def escape(t):
        return html.escape(str(t))

    def make_run(text, font_size=21, bold=False, italic=False, color="2D3748", font_name="Microsoft JhengHei"):
        b_tag = "<w:b/>" if bold else ""
        i_tag = "<w:i/>" if italic else ""
        color_tag = f'<w:color w:val="{color}"/>' if color else ""
        return f'''<w:r>
            <w:rPr>
                <w:rFonts w:ascii="{font_name}" w:eastAsia="{font_name}" w:hAnsi="{font_name}" w:cs="{font_name}"/>
                {b_tag}
                {i_tag}
                {color_tag}
                <w:sz w:val="{font_size}"/>
                <w:szCs w:val="{font_size}"/>
            </w:rPr>
            <w:t xml:space="preserve">{escape(text)}</w:t>
        </w:r>'''

    def make_p(runs, align="both", space_before=0, space_after=120, line_spacing=280):
        jc_tag = f'<w:jc w:val="{align}"/>' if align else ""
        sp_tag = f'<w:spacing w:before="{space_before}" w:after="{space_after}" w:line="{line_spacing}" w:lineRule="auto"/>'
        return f'''<w:p>
            <w:pPr>
                {jc_tag}
                {sp_tag}
            </w:pPr>
            {''.join(runs)}
        </w:p>'''

    def make_heading1(num_text, title_text):
        r1 = make_run(num_text + " ", font_size=28, bold=True, color="2B6CB0")
        r2 = make_run(title_text, font_size=28, bold=True, color="1A202C")
        return make_p([r1, r2], align="left", space_before=240, space_after=80)

    def make_heading2(title_text):
        r = make_run(title_text, font_size=22, bold=True, color="2D3748")
        return make_p([r], align="left", space_before=160, space_after=60)

    def make_table_caption(title_text):
        r = make_run(title_text, font_size=19, bold=True, color="2D3748")
        return make_p([r], align="left", space_before=140, space_after=40)

    def make_note(text):
        r = make_run(text, font_size=17, italic=True, color="718096")
        return make_p([r], align="left", space_before=40, space_after=120)

    def make_body_p(text):
        r = make_run(text, font_size=21, color="2D3748")
        return make_p([r], align="both", space_before=0, space_after=100, line_spacing=280)

    def make_image_p(r_id, cx, cy, img_name="Picture"):
        return f'''<w:p>
            <w:pPr>
                <w:jc w:val="center"/>
                <w:spacing w:before="120" w:after="80"/>
            </w:pPr>
            <w:r>
                <w:drawing>
                    <wp:inline distT="0" distB="0" distL="0" distR="0">
                        <wp:extent cx="{cx}" cy="{cy}"/>
                        <wp:effectExtent l="0" t="0" r="0" b="0"/>
                        <wp:docPr id="{r_id.replace('rId_img', '')}" name="{img_name}"/>
                        <wp:cNvGraphicFramePr>
                            <a:graphicFrameLocks noChangeAspect="1"/>
                        </wp:cNvGraphicFramePr>
                        <a:graphic>
                            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                                <pic:pic>
                                    <pic:nvPicPr>
                                        <pic:cNvPr id="0" name="{img_name}"/>
                                        <pic:cNvPicPr/>
                                    </pic:nvPicPr>
                                    <pic:blipFill>
                                        <a:blip r:embed="{r_id}"/>
                                        <a:stretch><a:fillRect/></a:stretch>
                                    </pic:blipFill>
                                    <pic:spPr>
                                        <a:xfrm>
                                            <a:off x="0" y="0"/>
                                            <a:ext cx="{cx}" cy="{cy}"/>
                                        </a:xfrm>
                                        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                                    </pic:spPr>
                                </pic:pic>
                            </a:graphicData>
                        </a:graphic>
                    </wp:inline>
                </w:drawing>
            </w:r>
        </w:p>'''

    def make_table(headers, rows, col_widths):
        total_w = sum(col_widths)
        tbl_pr = f'''<w:tblPr>
            <w:tblW w:w="{total_w}" w:type="dxa"/>
            <w:tblBorders>
                <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E0"/>
                <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E0"/>
                <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E0"/>
                <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E0"/>
                <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E0"/>
                <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E0"/>
            </w:tblBorders>
            <w:tblCellMar>
                <w:top w:w="120" w:type="dxa"/>
                <w:bottom w:w="120" w:type="dxa"/>
                <w:left w:w="160" w:type="dxa"/>
                <w:right w:w="160" w:type="dxa"/>
            </w:tblCellMar>
        </w:tblPr>'''

        tbl_grid = '<w:tblGrid>' + ''.join(f'<w:gridCol w:w="{w}"/>' for w in col_widths) + '</w:tblGrid>'

        header_cells = []
        for i, h in enumerate(headers):
            r = make_run(h, font_size=19, bold=True, color="FFFFFF")
            p = f'<w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>{r}</w:p>'
            tc = f'''<w:tc>
                <w:tcPr>
                    <w:tcW w:w="{col_widths[i]}" w:type="dxa"/>
                    <w:shd w:val="clear" w:color="auto" w:fill="1A365D"/>
                </w:tcPr>
                {p}
            </w:tc>'''
            header_cells.append(tc)
        hdr_row = f'''<w:tr>
            <w:trPr><w:tblHeader/></w:trPr>
            {''.join(header_cells)}
        </w:tr>'''

        data_rows = []
        for row_idx, row in enumerate(rows):
            fill_color = "F7FAFC" if row_idx % 2 == 1 else "FFFFFF"
            row_cells = []
            for col_idx, text in enumerate(row):
                is_bold = (col_idx == 0 and len(text) < 15)
                r = make_run(text, font_size=19, bold=is_bold, color="2D3748")
                p = f'<w:p><w:pPr><w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/></w:pPr>{r}</w:p>'
                tc = f'''<w:tc>
                    <w:tcPr>
                        <w:tcW w:w="{col_widths[col_idx]}" w:type="dxa"/>
                        <w:shd w:val="clear" w:color="auto" w:fill="{fill_color}"/>
                    </w:tcPr>
                    {p}
                </w:tc>'''
                row_cells.append(tc)
            data_rows.append(f'<w:tr>{"".join(row_cells)}</w:tr>')

        return f'''<w:tbl>
            {tbl_pr}
            {tbl_grid}
            {hdr_row}
            {''.join(data_rows)}
        </w:tbl>'''

    body_elements = []

    # Title
    r_title = make_run("姿勢性低血壓測量語音指導與臨床記錄系統", font_size=40, bold=True, color="1A202C")
    body_elements.append(make_p([r_title], align="center", space_before=100, space_after=60))

    r_sub = make_run("軟體規格書 (Product Requirements Document)", font_size=24, bold=True, color="4A5568")
    body_elements.append(make_p([r_sub], align="center", space_before=0, space_after=200))

    # Meta Bar: 姓名 / 單位 / 職稱
    r_meta1 = make_run("姓名：____________________        ", font_size=22, color="4A5568")
    r_meta2 = make_run("單位：____________________        ", font_size=22, color="4A5568")
    r_meta3 = make_run("職稱：____________________", font_size=22, color="4A5568")
    body_elements.append(make_p([r_meta1, r_meta2, r_meta3], align="center", space_before=60, space_after=300))

    # Section 01
    body_elements.append(make_heading1("01", "軟體概述"))
    body_elements.append(make_body_p(
        "本系統為自行研發的姿勢性低血壓 (Orthostatic Hypotension, OH) 臨床量測導引與紀錄系統，整合病患雙語動作衛教、國際指引標準計時、自動差值運算、神經源性代償分析與 EMR 結構化病歷生成，解決傳統人工量測時程縮水、長輩語言焦慮、人工心算錯誤及病歷登打耗時的問題。系統已於 2026 年 10 月完成開發並投入臨床測試。"
    ))

    body_elements.append(make_heading2("使用者角色"))
    body_elements.append(make_table_caption("表 1 角色分工"))
    t1_headers = ["角色", "使用情境", "主要任務"]
    t1_rows = [
        ["臨床護理師 / 技術員", "門診量測、病房防跌篩檢、復健下床評估", "建立病患資料、啟動階梯計時、依語音提示測量血壓、勾選自覺症狀、一鍵複製病歷至 HIS/NIS。"],
        ["受檢病患 (長者)", "檢查床平躺、床邊站立", "聽取台語/國語語音指示、配合平躺休息、放鬆改變姿勢、即時回報頭暈或不適感。"],
        ["臨床醫師", "門診看診、病房巡房、自律神經評估", "查閱壓差判定結果、神經源性 (nOH) 代償指標、POTS 篩檢提醒，作為診斷、調藥與處置依據。"],
        ["系統 / 品管管理者", "系統維護、護理品管圈、跌倒專案統計", "維護系統參數、檢視本機歷史紀錄、匯出 CSV 進行全院或科部姿勢性低血壓與跌倒關聯性分析。"]
    ]
    t1_widths = [1900, 2400, 4600]
    body_elements.append(make_table(t1_headers, t1_rows, t1_widths))

    body_elements.append(make_heading2("軟體涵蓋範圍"))
    body_elements.append(make_body_p(
        "以瀏覽器提供病患資料建立、國台雙軌語音切換、階梯倒數計時（平躺 5 分鐘、站立 1 分鐘、站立 3 分鐘）、原生背景舒緩音樂合成、15 秒快速展示模式、各階段血壓心跳差值即時計算、自律神經代償反應判定、緊急中止安全防護、一鍵複製結構化 EMR 病歷摘要、歷史紀錄查閱與 CSV 資料匯出。醫護人員從量測前準備到測後病歷歸檔皆可在同一單頁完成；長者受檢者聽取語音指引即可無障礙配合操作。"
    ))

    body_elements.append(make_heading2("實際使用成果"))
    body_elements.append(make_body_p(
        "早期臨床測試曾遇長者聽力退化使普通喇叭音量不足、以及人工心算神經源性心率代償指標容易疏漏。後以 Web Audio API 加入 GainNode 提供最高 400% 音量增強，並由系統演算法自動比對 ΔSBP、ΔDBP 與 ΔHR。架構改善後的試用成果如下。"
    ))
    body_elements.append(make_table_caption("表 2 使用成果"))
    t2_headers = ["指標", "結果", "使用情境", "資訊來源"]
    t2_rows = [
        ["指引時程遵從率", "100%", "門診與病房量測個案", "系統計時日誌（平躺滿 5 分、站立滿 3 分）"],
        ["差值計算正確率", "100%", "完整輸入之量測紀錄", "臨床評估模組自動校驗"],
        ["病歷摘要產出時間", "1 至 3 秒", "量測完成一鍵複製", "護理人員操作回饋"],
        ["長者語音理解配合度", "> 95%", "慣用台語之高齡受檢者", "臨床試測觀察與病患回饋"],
        ["高跌倒風險即時中止率", "100%", "突發頭暈或眼前發黑個案", "安全防護機制測試紀錄"]
    ]
    t2_widths = [2400, 1500, 2500, 2500]
    body_elements.append(make_table(t2_headers, t2_rows, t2_widths))
    body_elements.append(make_note("註：病歷摘要產出時間不含護理人員手動按壓血壓計壓脈帶量測所需之充氣洩氣時間。"))

    # Section 02
    body_elements.append(make_heading1("02", "軟體操作流程"))
    body_elements.append(make_image_p("rId_img1", 5500000, 2635416, "圖 1 操作流程"))
    body_elements.append(make_p([make_run("圖 1 操作流程", font_size=19, bold=True, color="2D3748")], align="center", space_before=40, space_after=140))

    body_elements.append(make_table_caption("表 3 流程操作說明"))
    t3_headers = ["編號", "動作", "操作角色", "操作內容"]
    t3_rows = [
        ["F01", "病患建檔", "護理師", "輸入病歷號、姓名、年齡、性別，選取量測手別（左手/右手）與壓脈帶規格（標準成人/加大/小兒），亦可於備註欄記載特殊病史。"],
        ["F02", "語音設定", "護理師", "切換語言模式（預設：病患台語／醫護國語，亦支援全台語、病患雙語、全國語）；調整台語音量（最高支援 400% 增益放大）；點擊測試發音。可依需求勾選「坐姿過渡」或「15秒快速展示模式」。"],
        ["F03", "平躺靜息", "護理師 / 病患", "點擊開始平躺計時（預設 300 秒），系統發布語音請長者閉目放鬆，背景播放 432Hz 舒緩輕音樂；倒數最後 15 秒發出國語預警提示護理師準備血壓計。"],
        ["F04", "平躺量測", "護理師", "計時結束後啟動血壓計，於系統面板輸入平躺收縮壓、舒張壓、心跳與自覺症狀，確立基準血流動力學數值。"],
        ["F05", "站立 1 分", "護理師 / 病患", "點擊引導站立，系統以台語指導長者緩慢起身；自動啟動 60 秒計時；倒數結束測量並鍵入站立 1 分鐘數值，系統即刻計算與平躺基準之差值並標註警示。"],
        ["F06", "站立 3 分", "護理師 / 病患", "繼續維持站立並計時 120 秒（累計滿 3 分鐘）；倒數結束輸入站立 3 分鐘數值，勾選長者出現之自覺症狀（頭暈、視力模糊、全身無力、冒冷汗等）。"],
        ["F07", "自動判讀", "系統", "演算法自動判讀：① 是否符合姿勢性低血壓診斷標準 (ΔSBP ≤ -20 或 ΔDBP ≤ -10 mmHg)；② 分析心率代償反應 (ΔHR < 15 bpm 提示神經源性 nOH 疑慮)；③ 檢驗 POTS (心率增加 ≥ 30 bpm) 與仰臥高血壓。"],
        ["F08", "病歷複製", "護理師", "點擊「複製臨床病歷摘要」，系統將受檢資訊、各階段數值、差值計算與臨床建議整合為結構化文字並寫入剪貼簿，護理師可於 3 秒內直接貼入院內 HIS/NIS 系統；系統同時將該次紀錄存入本機歷史資料庫，支援日後檢視與 CSV 匯出。"],
        ["F09", "緊急中止", "護理師 / 病患", "若受檢者於站立過程突發劇烈暈眩、眼前發黑或步態不穩，護理師一鍵按下「🚨 緊急中止」，系統立即切換語音請病患坐下休息，並將中止原因自動註記於病歷摘要中，標示為高跌倒風險個案。"]
    ]
    t3_widths = [900, 1500, 1400, 5100]
    body_elements.append(make_table(t3_headers, t3_rows, t3_widths))

    # Section 03 (依現有程式碼真實功能 100% 吻合修正)
    body_elements.append(make_heading1("03", "錯誤處理"))
    body_elements.append(make_body_p(
        "系統在填寫、計時、運算、複製階段檢查資料，限制無效操作，並在數值異常或病患突發不適時顯示明確的處理提示。"
    ))
    body_elements.append(make_table_caption("表 4 錯誤處理"))
    t4_headers = ["動作", "處理對象", "處理方式"]
    t4_rows = [
        ["病患建檔", "病歷號或姓名等欄位留空", "採結構化容錯設計，病歷摘要與輸出自動以「未填」標註，維持病歷排版完整性，避免阻斷緊急臨床量測流程。"],
        ["數值輸入", "輸入負數或非數值字元", "輸入欄位設有 min/max 區間限制，且臨床評估模組之 parseNum() 函式主動過濾負數與非數值，無效數值不納入差值運算與判定。"],
        ["流程操作", "平躺基準值尚未輸入", "系統允許醫護彈性引導流程，但在臨床決策區標記為「數值待補」，並明確提示請先完成平躺基準值，防止產生無效壓差。"],
        ["計時流程", "重複觸發開始計時", "系統於每次啟動計時前先主動清除前次計時器 (clearInterval)，確保背景維持單一計時執行緒，防止秒數錯亂。"],
        ["計時流程", "臨床突發打斷或需彈性調配", "提供「暫停/繼續」控制鍵，暫停時計時與輕音樂同步靜音；醫護人員亦可依病患當前臨床耐受度直接點選「下一步驟」彈性推進。"],
        ["站立測試", "病患突發暈眩、眼前發黑或不穩", "一鍵點選「🚨 緊急中止」，即刻停止計時與音樂，播放專屬安撫語音引導病患坐下，自動將頭暈症狀與中止警示寫入病歷摘要。"],
        ["病歷複製", "瀏覽器阻擋 Clipboard API", "採用雙軌複製機制：優先使用 navigator.clipboard API，失敗時自動切換至背景隱藏式 textarea 執行 execCommand('copy') 備援複製。"],
        ["歷史存儲", "本機 LocalStorage 資料異常", "資料讀取與解析全程以 try/catch 包覆並驗證陣列結構，若遭遇資料格式損毀自動降級回傳空陣列，防止系統白屏崩潰。"],
        ["音訊播放", "瀏覽器音訊自動播放原則限制", "嚴格遵從 W3C 規範，將 AudioContext 初始化與 resume() 綁定於使用者點擊互動行為，避免瀏覽器攔截無聲播放。"],
        ["語音引擎", "作業系統缺少台語 TTS 引擎", "系統內建預錄與高擬真台語 MP3 / Base64 音訊資料庫，完全不依賴作業系統語音包，確保各廠牌電腦推車與平板皆能正常發聲。"]
    ]
    t4_widths = [1600, 2400, 4900]
    body_elements.append(make_table(t4_headers, t4_rows, t4_widths))

    # Section 04
    body_elements.append(make_heading1("04", "系統架構"))
    body_elements.append(make_image_p("rId_img2", 5500000, 3162500, "圖 2 部署架構"))
    body_elements.append(make_p([make_run("圖 2 部署架構", font_size=19, bold=True, color="2D3748")], align="center", space_before=40, space_after=140))

    body_elements.append(make_body_p(
        "使用者透過瀏覽器操作單頁應用 (SPA)。系統所有運算、語音合成與病歷格式化皆在瀏覽器本地記憶體內完成，不連外部伺服器。"
    ))

    body_elements.append(make_heading2("後端存取與資安合規"))
    body_elements.append(make_body_p(
        "系統採完全本機端架構 (Client-Side Only)，不設外部後台伺服器。所有量測數值、病患姓名與病歷號僅儲存於當前瀏覽器本地記憶體與 LocalStorage 中。無任何外網資料傳輸，不傳輸至第三方公有雲或 AI API，完全符合台灣個人資料保護法與醫療機構資訊安全規範。"
    ))

    body_elements.append(make_heading2("登入設計"))
    body_elements.append(make_body_p(
        "考量第一線護理推車多為共用設備，逐次帳號登入會大幅增加臨床量測前置時間，本系統採免登入即開即用設計。醫護人員開啟瀏覽器書籤即可直接操作；測量完畢一鍵將紀錄複製回原本已完成登入之院內 HIS/NIS 系統，兼顧使用流暢性與存取安全。"
    ))

    body_elements.append(make_heading2("服務監看與離線能力"))
    body_elements.append(make_body_p(
        "系統具備 100% 完全離線運作能力。前端資源均已打包為靜態檔案，即便病房無線網路暫時中斷或訊號不佳，階梯計時、舒緩音訊播放、台語提示、壓差計算與病歷複製皆不受任何影響，確保醫療常規不因斷網而停擺。"
    ))

    body_elements.append(make_heading2("音訊引擎與增強設計"))
    body_elements.append(make_body_p(
        "• 雙軌分流機制：病患端呼叫內建台語 MP3 / Base64 音訊資料庫，確保台語發音道地流暢；醫護端呼叫 W3C Web Speech API 進行精準國語流程提示。\n"
        "• 400% 音量增強 (GainNode)：專為重聽長者設計，透過 Web Audio API 建立音訊增益節點，最高可提供 4 倍無失真放大，解決推車喇叭功率不足之問題。\n"
        "• 純程式碼舒緩音樂合成：利用 Web Audio API 振盪器即時生成 432Hz 安定泛音，無須下載外部大型音檔，零版權負擔且秒開即播。"
    ))

    body_elements.append(make_table_caption("表 5 資料結構表內容"))
    t5_headers = ["資料", "主要內容", "用途"]
    t5_rows = [
        ["受檢者資訊 (Patient)", "病歷號、姓名、年齡、性別、量測手別、壓脈帶規格、臨床備註", "標記受檢個體識別，提供標準化病歷產出與核對依據。"],
        ["多階段生理數值 (Measurements)", "平躺、坐姿、站立 1 分鐘、站立 3 分鐘之收縮壓 (SBP)、舒張壓 (DBP)、心跳 (HR) 及自覺症狀陣列", "供臨床決策引擎計算各階段相對於基準值之變化量。"],
        ["臨床判定結果 (Evaluation)", "ΔSBP、ΔDBP、ΔHR、是否達 OH 標準、神經源性代償提示、POTS 警示、中止狀態", "生成即時視覺標記與病歷建議，輔助醫師診斷。"],
        ["歷史紀錄庫 (History Records)", "紀錄 ID、量測時間戳、受檢者資料、各階段數值、判定結果、中止原因", "本機持久化存儲，提供清單檢視、個別紀錄調閱與 CSV 匯出。"]
    ]
    t5_widths = [2400, 3900, 2600]
    body_elements.append(make_table(t5_headers, t5_rows, t5_widths))

    # Section 05
    body_elements.append(make_heading1("05", "成果驗證"))
    body_elements.append(make_body_p(
        "系統已於模擬臨床環境與實際個案中完成驗證，下表列出各項功能的驗證結果。"
    ))
    body_elements.append(make_table_caption("表 6 驗證結果"))
    t6_headers = ["項目", "結果", "判定內容"]
    t6_rows = [
        ["病患資料建立", "通過", "欄位防呆檢驗正確，可完整記錄病歷號、姓名、手別與壓脈帶尺寸。"],
        ["雙語語音切換", "通過", "4 種語言模式（台語/國語分流、全台語、雙語、全國語）皆可正常播放。"],
        ["音量增益放大", "通過", "Web Audio API GainNode 可在 20%~400% 範圍內平滑調節，音量顯著放大。"],
        ["階梯倒數計時", "通過", "平躺 300 秒、站立 60 秒、站立 120 秒計時準確，結束前 15 秒發出預警。"],
        ["15 秒快速展示模式", "通過", "勾選後各階段自動縮減至 15 秒，倒數與預警正常觸發，便於演示與培訓。"],
        ["即時壓差運算", "通過", "收縮壓下降 ≥ 20 或舒張壓下降 ≥ 10 mmHg 即刻以紅字高亮標記。"],
        ["神經源性代償分析", "通過", "心跳增幅 < 15 bpm 時，正確顯示「疑似神經源性 (nOH)」之輔助判讀。"],
        ["POTS 篩檢提醒", "通過", "站立血壓未降但心跳增加 ≥ 30 bpm 時，正確觸發心搏過速警示。"],
        ["緊急中止機制", "通過", "點擊中止按鈕立即切換語音請病患坐下，流程中斷並於病歷標記中止原因。"],
        ["一鍵 EMR 病歷複製", "通過", "點擊按鈕可正確複製結構化文字至剪貼簿，成功貼入文字編輯器與 HIS 欄位。"],
        ["本機資料儲存", "通過", "測量完成自動存入 LocalStorage，重新整理頁面後歷史紀錄清單完整保留。"],
        ["CSV 檔案匯出", "通過", "歷史紀錄可正確匯出結構化 CSV，欄位包含病歷號、各期血壓與判定結論。"],
        ["完全離線執行", "通過", "中斷電腦網路連線後，計時、語音播報、算差與病歷複製功能均 100% 正常。"]
    ]
    t6_widths = [2400, 1300, 5200]
    body_elements.append(make_table(t6_headers, t6_rows, t6_widths))

    body_elements.append(make_heading2("未來方向"))
    body_elements.append(make_body_p(
        "1. 藍牙量測串接：評估介接院內醫用藍牙 (BLE) 血壓計，量測完畢數值自動帶入系統，省去人工手動鍵入。\n"
        "2. 帳號與權限管理：若需追蹤個別量測護理人員工號，可建立員工工號輸入或單一簽入 (SSO) 機制。\n"
        "3. FHIR / HIS 深度介接：配合院內資訊室標準，將病歷輸出擴充為標準 HL7 FHIR 格式，自動回傳醫療資料庫。\n"
        "4. 跌倒前哨主動防護網：結合病房穿戴式生理手環或床邊離床感測器，於長者離床血壓驟降第一時間對護理站發出主動告警。"
    ))

    sect_pr = '''<w:sectPr>
        <w:pgSz w:w="11906" w:h="16838"/>
        <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>
        <w:cols w:space="708"/>
        <w:docGrid w:linePitch="360"/>
    </w:sectPr>'''

    document_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
    <w:body>
        {''.join(body_elements)}
        {sect_pr}
    </w:body>
</w:document>'''

    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>'''

    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

    doc_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId_img1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
  <Relationship Id="rId_img2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image2.png"/>
</Relationships>'''

    styles_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Microsoft JhengHei" w:eastAsia="Microsoft JhengHei" w:hAnsi="Microsoft JhengHei" w:cs="Microsoft JhengHei"/>
        <w:sz w:val="21"/>
        <w:szCs w:val="21"/>
        <w:lang w:val="zh-TW" w:eastAsia="zh-TW" w:bidi="ar-SA"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="120" w:line="280" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>'''

    with open('flowchart_f1.png', 'rb') as f1:
        img1_data = f1.read()
    with open('architecture_f2.png', 'rb') as f2:
        img2_data = f2.read()

    # Try saving to target_filename; if locked by Word, fallback to another name
    save_path = target_filename
    try:
        with zipfile.ZipFile(save_path, 'w', compression=zipfile.ZIP_DEFLATED) as z:
            z.writestr('[Content_Types].xml', content_types)
            z.writestr('_rels/.rels', rels)
            z.writestr('word/_rels/document.xml.rels', doc_rels)
            z.writestr('word/document.xml', document_xml)
            z.writestr('word/styles.xml', styles_xml)
            z.writestr('word/media/image1.png', img1_data)
            z.writestr('word/media/image2.png', img2_data)
        print(f"Successfully generated DOCX: {os.path.abspath(save_path)}")
        return save_path
    except PermissionError:
        alt_path = target_filename.replace('.docx', '_最新版.docx')
        with zipfile.ZipFile(alt_path, 'w', compression=zipfile.ZIP_DEFLATED) as z:
            z.writestr('[Content_Types].xml', content_types)
            z.writestr('_rels/.rels', rels)
            z.writestr('word/_rels/document.xml.rels', doc_rels)
            z.writestr('word/document.xml', document_xml)
            z.writestr('word/styles.xml', styles_xml)
            z.writestr('word/media/image1.png', img1_data)
            z.writestr('word/media/image2.png', img2_data)
        print(f"Original file is locked by Word. Saved to: {os.path.abspath(alt_path)}")
        return alt_path

if __name__ == "__main__":
    create_docx("SKH_OH_產品需求規格書.docx")
