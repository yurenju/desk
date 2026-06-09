---
paths:
  - "docs/superpowers/plans/**/*.md"
---

# Plan 驗收報告

每份 implementation plan 的**最後一個 task**固定是「手動驗收 + 產生驗收報告」。報告是一份給使用者看的成果摘要：這份 plan 做了什麼、完成後有什麼改變、對照 spec 驗收標準的結果；UI 變更附**落地的截圖**。報告放在 gitignored 的 `docs/acceptance-reports/`，使用者看完自行決定刪不刪、不進版控。

這條 rule 同時規範兩個時機：寫 plan 時要把這個 task 加進去，執行該 task 時照下面步驟產報告。

## 寫 plan 時：加上驗收報告 task

plan 既有的「手動 preview 驗收」task（每份 plan 的最後一個 task）要**擴充**成同時產出報告。task 內容固定包含這些 step：

1. 起 dev server，用 playwright-cli + dev-login 登入（見下方「截圖落地」）。
2. 對照 spec 的驗收標準逐項實機操作驗收，記 pass / fail。
3. 截圖落地：把要佐證的畫面用 playwright-cli 存成 PNG 到 `docs/acceptance-reports/<plan-slug>/assets/`。
4. 寫 `docs/acceptance-reports/<plan-slug>/report.md`（範本見下）。
5. 告知使用者報告路徑，並提醒這份 gitignored、看完自行決定刪不刪。

`<plan-slug>` = plan 檔名去掉 `.md`，例如 plan `2026-06-09-task-detail-modal.md` → 報告目錄 `docs/acceptance-reports/2026-06-09-task-detail-modal/`。

## 截圖落地：用 playwright-cli

`preview_screenshot` 回傳 inline JPEG、**不落地存檔**，報告引不到。所以驗收與截圖**全程走 `playwright-cli`**（它的 `screenshot --filename` 會把檔案寫到磁碟，且 session 內多次 CLI call 之間 cookie 保留）。

**前置（machine 一次性，缺了才裝）**：

```bash
npm install -g @playwright/cli@latest
playwright-cli install --skills
```

**驗收流程**：

```bash
# 1. 起 dev server（cloudflare vite-plugin 一起跑 worker BFF，/api/dev-login 同源）
npm run dev -- --host 127.0.0.1 --port 5173   # 背景跑

# 2. 開 browser
playwright-cli open http://127.0.0.1:5173

# 3. dev-login：同源後用 eval 打 POST，cookie 會留給後續 call
playwright-cli eval "async () => (await fetch('/api/dev-login', {method:'POST'})).status"
#   回 200 = 登入成功；回 401 seed_refresh_failed = 種子過期，
#   依 CLAUDE.md「本機 preview 登入」走一次 device flow capture 再更新 canonical 檔。

# 4. 逐項驗收：snapshot 拿 element ref，再 click / fill / check 操作
playwright-cli snapshot
playwright-cli click <ref>

# 5. 截圖落地（命名 NN-描述.png，依序）
playwright-cli screenshot --filename docs/acceptance-reports/<plan-slug>/assets/01-foo.png
```

操作細節（ref、selector、各指令）交給 `playwright-cli` skill；這裡只規範登入方式、要截哪些、存哪、命名。

## report.md 範本

照這個結構寫（繁中敘述，程式碼 / 路徑英文）：

```markdown
# 驗收報告：<功能名稱>

> 對應 plan：[<plan 檔名>](../../superpowers/plans/<plan 檔名>)
> 對應 spec：[<spec 檔名>](../../superpowers/specs/<spec 檔名>)
> 驗收日期：<YYYY-MM-DD> ｜ 方式：playwright-cli 對真實 WSPC（測試帳號）實機操作
>
> ⚠️ 這份報告放在 gitignored 的 `docs/acceptance-reports/`，不會進版控。看完後自行決定保留或刪除。

## 這份 plan 做了什麼

<1–2 段，從 plan 的 Goal 來，講清楚交付了什麼。>

## 完成後有什麼改變

<以「完成後狀態」為主：條列「本來沒有／現在有」，可用一個「本來 / 現在」對照表。
UI 變更內嵌「完成後」截圖（相對路徑 assets/NN-*.png）；非 UI 變更用測試輸出片段或
API request/response 範例當佐證。>

![<截圖說明>](assets/01-foo.png)

## 驗收結果

<對照 spec 驗收標準逐條列表。狀態三態：✅ PASS／⚠️ 部分／⬜ 未驗（標明原因，未驗 ≠ 失敗）。>

| # | 驗收標準 | 結果 | 佐證／備註 |
| --- | --- | --- | --- |
| 1 | … | ✅ PASS | 截圖 01 |

## 已知限制 / 備註

<transient 錯誤、未涵蓋項、後續待辦等；沒有就省略這節。>
```

## 非 UI 的 plan

純 BFF / API、無畫面的 plan：報告跳過截圖，「完成後有什麼改變」用測試輸出片段、`curl` / API request-response 範例當佐證，其餘結構不變。
