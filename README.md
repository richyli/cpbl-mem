# 中職球團付費會員方案 — 線上 Conjoint 問卷

職棒會員卡風格的 CBC 網頁問卷。單檔 `index.html` + `config.js`（設計）+ `survey.js`（邏輯）。

## 設計
- 6 屬性 × 各 4 水準（見 `../analysis_output/design_memo_classified.md`）
- CBC 二選一、**8 正式輪**；另插 1 trap + 1 鏡像重複 = 共 10 個呈現題
- 屬性順序：受訪者間隨機、受訪者內固定
- 水準：每輪即時隨機；避免支配組合 + 完全相同 + 同質媒體
- dual-response：每輪選完再問「是否真的會加入」
- 三組量表（球隊認同/社群認同/知覺價值）+ marker 題（CMV）+ 人口題

## 七條品質檢核對應（SoT: wiki/conjoint_webform_quality_checks.md）
| # | 檢核 | 落地 | 欄位 |
|---|------|------|------|
| 1 | 鏡像重複一致性 | 第3輪於第7位鏡像重現，比選到哪張卡 | `rep_of/_orig/_again/_consistent/_rtMs` |
| 2 | 注意力 trap | 第2位插入「請點方案 A」，題幹閃爍 | `trap_side/_pick/_pass/_rtMs` |
| 3 | leftRatio | 選 A(左)次數/總題 | `leftRatio` |
| 4 | rtMs | 每題反應時間；minAnswerSec=2 記錄不擋 | `r*_rtMs`、`minAnswerSec` |
| 5 | dominance | genPair 排除一卡全屬性 ≥ 另一卡 | 設計階段保證 |
| 6 | identical 重抽 | genPair 排除兩卡完全相同 | 設計階段保證 |
| 7 | 同質媒體重抽 | media 無高低序，不納支配判斷；其餘由 5/6 涵蓋 | — |

## 部署步驟
1. 建 GitHub public repo（如 `richyli/cpbl-membership-survey`），放 index.html + config.js + survey.js。
2. 開 GitHub Pages。
3. **SheetMonkey 建新 form**（本研究獨立，勿用既有 endpoint）→ 把 form URL 填入 `config.js` 的 `SHEETMONKEY_URL`。
4. 管道實測：手動填一筆（含中文）確認進 Sheet、UTF-8 無亂碼、欄序乾淨（正式收樣前清空 Sheet）。
5. 把 form URL / Sheet ID / Pages URL / CSV export URL 追加到 memory `reference_sheetmonkey_endpoint`。

## 注意
- 送出失敗有 localStorage 暫存 + 下載 JSON fallback。
- 欄位約 162 欄；SheetMonkey 依第一筆建欄序，開發中途加欄會跑到最末 → 正式前清 Sheet。
