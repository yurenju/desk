# Slice 2c — UI 打磨（登入流程 + Today 互動遺留物）設計

本文件定義 `desk.yurenju.me` 在 Slice 2c 要完成的範圍：把接上 WSPC（Slice 2a / 2b）過程中，為了範圍紀律刻意延後、用裸 HTML 或最小互動撐住的 UI 遺留物，一次補上中高保真度的打磨。**這片只動視覺與互動細節，不碰 auth 邏輯、KV、token 流程、todo 資料模型。** 優先權與 adhoc 的寫入沿用既有的 store action（`setDailyPriority`、`editTitle` 等）與 patch queue，本片不改資料層語意。

## 範圍與動機

ROADMAP 原本的 Slice 2c 只涵蓋「登入流程 UI 打磨」。實作 2b 時又累積了幾項 Today mode 的互動遺留物（優先權只能循環、計畫外無法轉計畫內、touch 裝置靠寬度斷點硬撐、一週從星期一開始），都是「先接起來、之後再打磨」的東西。這片把登入動線與這些 Today 互動遺留物併在同一份 spec 一起處理，因為它們本質相同：都是視覺 / 互動層的收尾，彼此獨立、無資料層風險，適合一輪做完。

### 2c 的明確邊界

| 做 | 不做 |
|---|---|
| LoginPage 套 design system（卡片、紙感、tokens） | 任何 auth 邏輯 / KV / token 流程改動 |
| 登入四種狀態的色 / 文案 / 重試入口 | todo 資料模型 / custom fields 變更 |
| AuthMenu 改 dropdown（含主題切換） | 軌跡 / 略過 / Monthly / Backlog / carryover |
| 優先權改 dropdown 選取 | `position` 排序、跨欄拖曳 |
| 計畫外 ⇄ 計畫內雙向切換 | 新增 store action（沿用既有 `setDailyPriority` 等） |
| Touch 裝置以 hover-capability 偵測 | bottom sheet（menu 桌面 / touch 共用 dropdown） |
| 一週改星期日開始 | Plan mode 可寫（仍唯讀） |

## A. 登入流程

現況：[src/pages/LoginPage.tsx](src/pages/LoginPage.tsx) 與 [src/features/shell/AuthMenu.tsx](src/features/shell/AuthMenu.tsx) 都是裸 HTML（`<main>` / `<a>` / `<span>` / `<button>`），沒有套任何 design token。device flow 用的是 `verification_uri_complete`，URL 已帶上 `?user_code=…`，使用者點按鈕到 WSPC 後，WSPC 直接顯示該碼讓他**核對**並 Approve，不需手動輸入或貼上。

### A1. LoginPage 版型（行動優先，碼為核對用）

- 置中卡片版型，套 design tokens + CSS Modules + 紙感背景，與主畫面一致
- **primary 按鈕「在 WSPC 開啟授權頁 ↗」當視覺主角**，取代原本的裸 `<a>`，改用 `Button` primitive（`variant="primary"`）
- 驗證碼配「核對碼」label 放在按鈕**下方**，當輔助資訊；等寬字體（`--font-mono`）、放大、加字距
- **不做一鍵複製**：碼的角色是核對兩邊一致，不是貼到別處
- 文案改寫：說明從「輸入這組碼」改為「點按鈕到 WSPC，核對畫面上的碼與下方一致後按 Approve，本頁會自動進入」

### A2. 四種狀態的色 / 文案 / 重試

`PollState` 已有 `idle / pending / authenticated / denied / expired / error`。本片補上各自的視覺與「下一步」：

| 狀態 | 狀態色 | 文案 | 重試入口 |
|---|---|---|---|
| pending | 中性灰藍 | 等待授權中⋯（spinner）+「核對碼後按 Approve」提示 | — |
| denied | 警示紅 | 授權已被拒絕 | 「重新登入」按鈕 |
| expired | 提醒黃 | 驗證碼已過期 | 「重新產生驗證碼」按鈕 |
| error | 中性灰 | 系統錯誤，請稍後再試 | 「重試」按鈕 |

三個失敗狀態的重試動作本質相同 —— 重新發起一輪 device flow（重新 `POST /api/auth/login` 拿新碼、重啟 polling），只是按鈕文案隨語意不同。實作上抽一個共用的「重新發起」函式，三顆按鈕共用、各自帶不同 label。狀態色取自既有 token，新增的語意色（warn / danger）若 token 未定義則補進 `src/tokens/colors.css`。

### A3. AuthMenu 改 dropdown

- **已登入**：avatar（display_name 首字）+ display_name，點開 dropdown menu，內含：email（唯讀資訊列）、主題三態切換、登出。用 Base UI 的 Menu / Popover 元件。
- **未登入**：「登入 WSPC」改用 `Button` primitive，取代裸 `<Link>`，放在原 `.actions` 區位置。

### A4. 主題切換移進 menu

- 現況：`ThemeToggle` 是 TopNav `.actions` 區的獨立元件。已登入時改放進 AuthMenu 的 dropdown，用三態 SegmentedControl（自動 / 淺 / 深，對應現有 `useTheme` 的 `auto / light / dark`）。
- **未登入 fallback（方案 X）**：未登入沒有 dropdown，`ThemeToggle` 仍以獨立控制項留在 `.actions` 區（登入頁也要能切主題）。即：未登入 → 主題鈕獨立 + 登入 Button；已登入 → 主題收進 menu，`.actions` 區只剩 avatar。

### A5. loading 過場與 mobile

- 確認 `status === "loading"` 時 AuthMenu 不讓 header 跳動或閃爍（現況 render `null`，確認過場順、保留空間）
- Mobile：窄視窗下登入卡片置中不溢出、header 登入狀態（avatar / 登入 Button）排版正常

## B. Today task 互動

### B1. 優先權改 dropdown 選取

現況：[src/features/day/useTaskRow.ts](src/features/day/useTaskRow.ts) 的 `cyclePriority` 讓 priority ring 循環 `+ → 1 → 2 → 3 → 無`；[src/ui/PriorityRing/PriorityRing.tsx](src/ui/PriorityRing/PriorityRing.tsx) 是單一 button。

- 點 priority ring 改為**開 dropdown**，直接選「① 今日第一 / ② 今日第二 / ③ 今日第三 / — 移除重點」
- **選到已被佔用的位子 → 自動騰位**（原佔用者被擠成 `null`）。這沿用既有 `setDailyPriority` + patch queue（PR #13）的騰位語意，本片不改資料層，只把入口從循環換成直接選。menu 內目前選中的位子標示 ✓；不額外標示「會擠掉誰」（做法 1：選單乾淨）。
- `cyclePriority` 改為 `setPriority(value)`，由 menu 項目直接帶值呼叫；循環專用的 `nextPriority` / `nextFreeSlot` 邏輯一律移除，全部走明確選取（不保留「快速設第一個空位」的捷徑）。

### B2. 計畫外 ⇄ 計畫內（雙向）

現況：[src/features/day/DayColumn.tsx](src/features/day/DayColumn.tsx) 依 `is_adhoc` 把 Today 的 primary task 分成「其他計劃內」（`is_adhoc !== "true"`）與「今天臨時加的」（`is_adhoc === "true"`）兩區。[src/features/day/TaskRow.tsx](src/features/day/TaskRow.tsx) 行尾動作只有 ✎ 編輯、🗑 刪除（hover 顯示）。

- 用 **overflow ⋯ menu** 承載雙向切換（取代在 chip 上動手腳，因為計畫內 task 沒有 chip 可點）：
  - 計畫外（`is_adhoc === "true"`）→ menu 顯示「↑ 移到計畫內」
  - 計畫內（`is_adhoc !== "true"`）→ menu 顯示「↓ 標為計畫外」
- 底層動作：toggle task 的 `is_adhoc`（`"true"` ⇄ `"false"`），透過既有 patch 路徑（patch queue）寫回 WSPC，樂觀更新 + 失敗回滾。task 切換後自動在「其他計劃內」與「今天臨時加的」兩區之間移動（分區條件已是 `is_adhoc`，不需額外邏輯）。
- 把現有的 ✎ 編輯、🗑 刪除一併收進這個 ⋯ menu，行尾改為單一 ⋯ 入口（行更乾淨、之後其他 row 動作有統一入口）。menu 為情境式：primary row 才顯示完整動作；trail row 維持唯讀（只能勾完成）。

### B3. Touch 裝置呈現

現況：[src/features/day/TaskRow.module.css](src/features/day/TaskRow.module.css) 用 `.row:hover .actions { opacity: 1 }` 帶出動作，並以 `@media (max-width: 640px) { .actions { opacity: 1 } }` 當常駐 fallback。寬度斷點抓不準觸控裝置（觸控筆電 / 平板寬度 > 640 但無 hover）。

- 改用 **`@media (hover: none)`**（搭配 `pointer: coarse`）偵測「裝置能不能 hover」取代寬度斷點：無 hover → 行尾 ⋯ 入口常駐顯示；有 hover → 維持 hover 才顯示。
- menu 桌面 / touch **共用同一個 dropdown 元件**（不另做 bottom sheet）。在 touch 環境放大觸控目標：menu 項目高 ≥ 44px、⋯ 觸發鈕加大 hit area。

### B4. 一週改星期日開始

現況：[src/lib/date.ts](src/lib/date.ts) 的 `weekOf` 回傳星期一到星期日（`mondayOffset` 邏輯）。

- 改為回傳**星期日到星期六**：回退到該週的星期日（`d.getDate() - d.getDay()`，`getDay()` 0 = 星期日），往後取 7 天。
- 連帶更新 [src/lib/date.test.ts](src/lib/date.test.ts) 的 `weekOf` 測試期望值。
- WeekRail / DayChip 讀 `weekOf` 不需改動；`shortWeekday` 已支援 `Sun`。`isoWeek`（ISO 週數，獨立計算）不受影響。

## 元件與檔案影響

| 檔案 | 變更 |
|---|---|
| `src/pages/LoginPage.tsx` + 新 `.module.css` | 卡片版型、按鈕主角、核對碼、四狀態、共用重新發起函式 |
| `src/features/shell/AuthMenu.tsx` + `.module.css` | 改 dropdown（avatar + menu）、未登入 Button |
| `src/features/shell/TopNav.tsx` / `ThemeToggle` | 主題切換移進 menu；未登入獨立留 `.actions` |
| `src/ui/PriorityRing/PriorityRing.tsx` | ring 改為 dropdown 觸發器 |
| `src/features/day/useTaskRow.ts` | `cyclePriority` → `setPriority(value)`；新增 `toggleAdhoc` |
| `src/features/day/TaskRow.tsx` + `.module.css` | 行尾 ✎🗑 收進 ⋯ menu；計畫內外切換項；touch hover 偵測 |
| `src/lib/date.ts` + `date.test.ts` | `weekOf` 改星期日開始 |
| `src/tokens/colors.css` | 視需要補 warn / danger 語意色 |

## 測試策略

- **純函式**：`weekOf` 改星期日開始的單元測試（含跨月、跨年邊界）。
- **互動（vitest + Testing Library）**：
  - LoginPage 四狀態各自 render 正確文案 + 重試按鈕；點重試重新發起 device flow。
  - AuthMenu 已登入 / 未登入 / loading 三態；dropdown 開啟顯示 email / 主題 / 登出；登出呼叫。
  - 優先權 dropdown：選某位子呼叫 `setDailyPriority`；選已佔位子觸發騰位（被佔者 PATCH `null`）。
  - 計畫外 ⇄ 計畫內：toggle 後 task 換區、`is_adhoc` 正確、失敗回滾。
- **既有測試回歸**：`useTaskRow.test.ts`、`TaskRow.test.tsx`、`LoginPage.test.tsx`、`AuthMenu.test.tsx` 隨改動更新。
- **手動測試（preview + AI agent）**：自動化測試之外，由 AI agent 透過 `preview_start` 開預覽，實際操作畫面驗證視覺與互動 —— 登入動線四狀態的觀感、優先權 dropdown 騰位、計畫外 ⇄ 計畫內換區、touch 目標、一週排列、dark / light 過場等難用單元測試涵蓋的部分。需要真實登入（device flow 要在 WSPC 按 Approve）時，請使用者協助完成登入後再續跑。對照本文件「驗收標準」1–10 逐項手動驗收。

## 驗收標準

1. 登入頁為置中卡片、紙感背景，與主畫面同一套視覺；primary 按鈕為主角，核對碼在按鈕下方、無複製鈕。
2. 拒絕 / 過期 / 系統錯誤三種失敗各自顯示對應色與文案，且都能一鍵重新發起 device flow 拿新碼。
3. 已登入時 header 顯示 avatar + display_name，點開 menu 有 email、主題三態切換、登出；未登入顯示「登入 WSPC」Button。
4. 未登入時主題仍可切換（獨立鈕）；已登入時主題切換在 menu 內。
5. 切換主題、登入 / 登出過場不造成 header 跳動或閃爍。
6. 點 priority ring 開 dropdown，可直接設 ①②③ 或移除；設到已佔位子時原佔用者被擠成無。
7. 「今天臨時加的」task 可從 ⋯ menu 移到計畫內（移到「其他計劃內」區）；計畫內 task 可反向標為計畫外。
8. 觸控裝置（無 hover）行尾 ⋯ 入口常駐可見、觸控目標夠大；桌面維持 hover 顯示。
9. WeekRail 一週從星期日開始排列。
10. Mobile 窄視窗下登入卡片與 header 登入狀態排版正常。

## 對 ROADMAP 的影響

ROADMAP 原 Slice 2c 只列登入打磨。本片完成後應更新 2c 條目：標題改為「UI 打磨（登入流程 + Today 互動）」，並把優先權 dropdown、計畫外 ⇄ 計畫內、touch 偵測、一週改星期日開始補進 checklist。
