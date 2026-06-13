# desk.yurenju.me - 專案路線圖 (Roadmap)

這個專案是 `desk.yurenju.me` 個人儀表板（整合 Mail、Calendar、Todo），運行於 Cloudflare Workers (using Wrangler Assets)，後端使用 WSPC (https://wspc.ai) 服務。

專案優先實作 **Todo 與個人工作流**，其後依序擴充 **Calendar** 與 **Mail**。

## 開發策略：垂直切片，每片可用

第一階段採 **垂直切片** 方式推進，而非「先 infra → 再 auth → 再 UI」的水平層。每個 Slice 都是一條從畫面到資料的完整通路，**範圍刻意縮小**，但完成後都能真的點開來看、能 ship、能根據實際手感調整下一片的設計。

原則：

1. **Slice 0 / 1 故意不接 WSPC**：先在零後端成本的環境 burn 掉視覺與互動的迭代。
2. **Slice 2 是唯一一片「沒新功能但很重」**：auth + BFF + 一個端點就停，不順手做別的。
3. **每片保留可 demo 的單一畫面**：寧可砍欄位、不要砍「能不能用」。
4. **軌跡 / 略過 / carryover 各自獨立成片**：這三段最有想像空間、最可能看到後想改，分開 ship 才有機會調整。

## 目前進度

| Slice | 狀態 | 對應 PR |
|---|---|---|
| Slice 0 — 純前端骨架 | ✅ 完成 | [#2](https://github.com/yurenju/desk/pull/2) |
| Slice 1 — Today 互動 + localStorage | ✅ 完成 | — |
| Slice 2a — auth + BFF 骨架 | ✅ 完成 | [#8](https://github.com/yurenju/desk/pull/8) |
| Slice 2b — /api/todo + 前端銜接 | ✅ 完成(已部署驗收) | [#10](https://github.com/yurenju/desk/pull/10) |
| Slice 2b 加固 — patch queue 修競態 | ✅ 完成 | [#13](https://github.com/yurenju/desk/pull/13) |
| Slice 2c — UI 打磨（登入流程 + Today 互動） | ✅ 完成 | — |
| Slice 3 — Monthly 互動 + promote | ✅ 完成 | — |
| Slice 3.5 — Plan 週導覽 + Day 欄可規劃 | ✅ 完成 | [#16](https://github.com/yurenju/desk/pull/16) |
| Slice 4 — Plan 模式完整拖曳 + Backlog 互動 | ✅ 完成 | — |
| Slice 5 — Focus 丟回月度（部分） | ✅ 部分完成(2026-06-13) | — |
| Slice 6 — Focus 移到今天（部分） | ✅ 部分完成(2026-06-13) | — |
| Slice 5/6 其餘項目 | ⏳ 規劃中 | — |

**Slice 0 比原規劃多做的部分**(因為「中高保真度」視覺要做到位,自然把後面 slice 的純視覺工作也帶進來了):

- ✅ Backlog 摺疊區 UI(原 Slice 4 — 現在 UI + 展開互動已完成,Slice 4 改為「實際寫入語意」)
- ✅ CarryoverBanner 靜態 UI(原 Slice 6)
- ✅ Trail 樣式渲染(forwarded / dismissed)+ `tasksOnDate` / `tasksOnMonth` derivation(原 Slice 5 — 純函式 + 視覺先就位,Slice 5 改為「實際寫 `unscheduled_*` + 動作」)
- ✅ Mock data 涵蓋全部 trail 情境(順延 / 略過 / 完成)

---

## 🚀 第一階段：Todo 個人工作流（垂直切片）

### Slice 0 — 純前端骨架（無資料、無 auth）✅

**目標**：把視覺與版型先做出來，在沒有任何後端干擾下確認 token 與設計。

**完成於 PR [#2](https://github.com/yurenju/desk/pull/2)**(32 commits)

- [x] Cloudflare Workers + Vite + React 18 + TS via `@cloudflare/vite-plugin`(改為單 package BFF,非 Vite-only)
- [x] 安裝 [Base UI](https://base-ui.com)(實際 package 是 `@base-ui/react@^1.5.0`,原計畫的 `@base-ui-components/react` 已 deprecated)+ CSS Modules + CSS Custom Properties
- [x] Design tokens 依 HANDOFF §4 寫入 `src/tokens/*.css`(6 個 token 檔 + light/dark via `[data-theme]`)
- [x] TanStack Router 三條路由(`/` → `/today`、`/plan`、`/today`)
- [x] Plan mode 三欄版型(Monthly 含 Backlog 摺疊 / Week / Selected Day)
- [x] Today mode 三欄版型(WeekRail / DayColumn hero / MonthDigest)
- [x] Mobile responsive(Plan 用 tab、Today 底部 DayChip 條)
- [x] 7 個 UI primitives(Button / Checkbox 含 hand-drawn ✓ / Chip / SegmentedControl / ProgressBar / PaperTexture / DeskLogo)
- [x] 純函式 derivation:`primaryDate` / `primaryMonth` / `layer` / `tasksOnDate` / `tasksOnMonth`(17 vitest)
- [x] `useTheme` hook(auto / light / dark + localStorage,4 vitest)
- [x] Mock data 涵蓋 backlog / monthly top3 / others / adhoc / done / forwarded / dismissed 全部情境
- [x] Claude Code preview launch.json
- [x] 基礎字體 15px(從原計畫 13px 調整)

**過程中發現需要 fix 的問題**(都已解決):
- Cloudflare Vite plugin 跟 vitest 不相容 → guard with `process.env.VITEST`
- Test helper spread override 觸發 TS2783 → 重構 spread 順序
- TanStack Router 的 `routeTree.gen.ts` 路徑跟文件不同 → 在 `src/` 而非 `src/routes/`
- DeskLogo 在 dark mode 變黑(失去紙感)→ 鎖在 brand 色不跟 theme 翻轉

**沒做**:拖曳、CRUD mutation、WSPC、auth、Zustand、motion library、年規劃、快捷鍵實作

### Slice 1 — Today 互動 + localStorage ✅

**目標**:在沒有 auth 噪音的情況下確認「最小可用單元」的 UX 與資料寫入流程。

> **跟原計畫的差異**:原本寫「單欄 Today」,但 Slice 0 已經把完整 Plan/Today 三欄版型都做出來了。Slice 1 改為直接把 Today mode 的 task 變成可互動,Plan mode 跟 Backlog 暫時還是唯讀。

- [x] 引入 Zustand store(`useTasksStore`),取代直接 import mock data
- [x] localStorage persistence(`zustand/middleware/persist`,key `desk.tasks`)
- [x] Today mode 的 task:
  - [x] 勾選完成(寫入 `status: "done"` + `done_on`)
  - [x] 取消完成(`status: "open"`,清掉 `done_on`)
  - [x] 新增任務(從「+ 加一件今天的事」入口,`scheduled_dates = [today]`、`is_adhoc = true`)
  - [x] inline 編輯 title(雙擊或點 edit 進入)
  - [x] 刪除(右鍵 menu 或行尾按鈕)
- [x] `daily_priority` 1/2/3 切換(點 ring 切下一個值,或選單)
- [x] 第一次載入時 seed mock data 進 store(只有當 store 是空的)
- [x] Plan mode 的 task **仍唯讀**(下一片再開放),但要能正確讀 store

**可以看到什麼**:每日焦點的互動手感(完成動畫、空狀態、`is_adhoc` chip 怎麼出現),刷新後資料還在。
**不做**:WSPC、auth、Plan mode 的拖曳、Backlog 互動、軌跡的寫入。

**過程中發現、暫時擱置的設計問題**:

- **移除了三件事的「對應月度任務」標記(`PlannedRefChip`)**:原本三件事每列標題下方會顯示一個小圈號 + 父任務標題(例:`① 推出 desk.yurenju.me MVP`),靠 mock data 的 `parent_id` 指向月度任務。但這個「月、日各存在一個 task、用 `parent_id` 連起來」的父子模型與本 ROADMAP 的資料模型**矛盾** —— 正確設計是**同一個 task 透過 `scheduled_months` + `scheduled_dates` 同時出現在月度欄與日欄**(見「共用參考:資料模型」),不該有兩個互相對應的 task。而且那個圈號還綁錯欄位(顯示 task 自己的 `daily_priority` 而非父任務的 `monthly_priority`,又與左側優先序圈重複)。Slice 1 先把這個顯示拿掉,待 **Slice 3(Monthly 互動 + promote)** 接上真實漏斗模型時一併處理;mock data 的 `parent_id` 也應隨之淘汰。

### Slice 2a — auth + BFF 骨架（仍只有 localStorage）✅

**目標**：把 auth 鏈跑通，但完全不碰 todo 資料。Slice 1 的所有互動仍走 localStorage。

**完成於 PR [#8](https://github.com/yurenju/desk/pull/8)**

> 設計文件：[2026-05-30-slice-2a-auth-bff-design.md](docs/superpowers/specs/2026-05-30-slice-2a-auth-bff-design.md)

- [x] Cloudflare KV namespace `DESK_KV`（單一 namespace、三類 key：`wspc:client_id` / `session:<id>` / `device:<polling_id>`）
- [x] WSPC 動態 client 註冊（第一次 `/api/auth/login` 時 lazy 完成，`wspc:client_id` 存 KV）
- [x] BFF 認證路由：`/api/auth/login`、`/api/auth/status`、`/api/auth/logout`
- [x] `__Host-Session` cookie + KV session + token 自動刷新中間件
- [x] `/api/me` proxy 到 WSPC `/auth/me`（demo 端點，證明 token 真的能授權打 WSPC）
- [x] 前端 `/login` route：顯示 user_code、verification URL、polling 狀態
- [x] Header 加登入狀態：未登入顯示「登入 WSPC」按鈕、已登入顯示 display_name + 登出
- [x] Zustand `useAuthStore`（不 persist，每次重整重新驗證 `/api/me`）

**可以看到什麼**：從 desk.yurenju.me 走完整 device flow 登入後，header 顯示自己的 WSPC email / display_name。Today / Plan / Backlog 三個 mode 的互動完全不變。
**Owner 防護**：**不鎖**。任何人都可以用自己的 WSPC 帳號登入看自己的 todo（multi-tenant）。
**不做**：todo 端點、DeskTask 型態註冊、前端任何資料源切換。

### Slice 2b — `/api/todo` 接上 WSPC + 前端銜接 ✅

**目標**：把 Today mode 從 localStorage 換成真實 WSPC 資料。

**完成於 PR [#10](https://github.com/yurenju/desk/pull/10)**(含手動驗收修復;已部署到 production 跑過驗收)

> 設計：[2026-05-31-slice-2b-todo-design.md](docs/superpowers/specs/2026-05-31-slice-2b-todo-design.md)・計畫：[2026-05-31-slice-2b-todo.md](docs/superpowers/plans/2026-05-31-slice-2b-todo.md)

- [x] **Lazy 建立 Desk project + KV 存 `project_id`（per-user `desk:bootstrap:<user_id>`）** —— WSPC todo 必須屬於某 project，type 註冊的前置條件
- [x] WSPC `DeskTask` 自訂型態註冊（一次宣告完整 9 個 custom fields，雖然這片只用到一部分）
- [x] `/api/todo` 端點：list / create / patch（status、daily_priority、done_on、title）
- [x] 過濾條件：`scheduled_dates contains today` —— 用 WSPC `cf.scheduled_dates`(server 端 array-contains)

> ⚠️ `cf.<field>` 過濾**未寫進主 OpenAPI**(2026-06-01 重新確認仍未文件化),但 MCP tool / `llms.txt` 有,且已用 `scripts/verify-wspc.mjs` 對線上實證(dotted 語法有效;早期「打錯 key 靜默回整包」的漏洞已被 WSPC 修為 422 `UNKNOWN_CUSTOM_FIELD`)。filter key 仍鎖成常數作為單一真實來源 + typo 防呆;工具留作回歸檢查。

**從 Slice 1 銜接過來要處理**（Slice 1 刻意用最小前端做法、延後到接 WSPC 才補的衍生事項）：

- [x] `today` 真實化 + 可切換日期：換成真實今天(local YYYY-MM-DD)並支援 `/today/$date` 切換日期
- [x] 刪除改 soft-delete：改為 PATCH `status: cancelled`;undo 改為 server-aware(復原 = PATCH 回原 status),並接上 mutation 失敗 toast(讀 store.error,涵蓋所有 mutation)
- [x] seed → 真實資料：store 改由 `/api/todo` list 載入,移除 persist 與 mock seed;新增 `status: loading/ready/error` 載入狀態(skeleton/error+retry),首次 bootstrap 延遲被它吸收
- [x] `daily_priority` 騰位要 patch 兩筆：前端編排,被騰位者也對 server 發 PATCH(`daily_priority: null`);全程樂觀更新 + 失敗回滾

**可以看到什麼**：Today 換成真實 WSPC 資料；auth 鏈端到端跑通。
**不做**：軌跡、略過、Monthly、Backlog。
**驗收**：已部署到 production 並完成手動驗收(設計文件「驗收標準」1–10:首次 bootstrap、CRUD 落地、騰位、切日、第二帳號 multi-tenant 分流、登出清快取)。

### Slice 2b 加固 — todo patch queue(修騰位競態）✅

**目標**：2b 的 `daily_priority` 騰位要對兩筆 task 各發一次 PATCH,並發時會撞在一起(priority-ring race condition)。這片加上 per-id PATCH 序列化 + coalescing queue 收斂。

**完成於 PR [#13](https://github.com/yurenju/desk/pull/13)**

> 設計：[2026-06-01-todo-patch-queue-design.md](docs/superpowers/specs/2026-06-01-todo-patch-queue-design.md)・計畫：[2026-06-01-todo-patch-queue.md](docs/superpowers/plans/2026-06-01-todo-patch-queue.md)

- [x] per-id PATCH 序列化佇列 + 同 id 連續 patch 合併([todoQueue.ts](src/lib/api/todoQueue.ts))
- [x] mutation 全程走 patch queue;優先序衝突時 reload(而非 rollback)
- [x] e2e mock WSPC upstream,讓 Today e2e 跑真實 BFF([#11](https://github.com/yurenju/desk/pull/11))
- [x] skeleton 改用既有 theme token,避免 dark mode 殘留淺灰([#12](https://github.com/yurenju/desk/pull/12))

### Slice 2c — UI 打磨（登入流程 + Today 互動）✅

**目標**：把接 WSPC（Slice 2a / 2b）過程中為了範圍紀律延後、用裸 HTML 或最小互動撐住的 UI 遺留物一次補上中高保真度。範圍從原本「只有登入流程」擴大到一併處理 Today 互動的遺留物。**只動視覺與互動，不碰 auth 邏輯 / KV / token / todo 資料模型。**

> 設計：[2026-06-06-slice-2c-ui-polish-design.md](docs/superpowers/specs/2026-06-06-slice-2c-ui-polish-design.md)・計畫：[2026-06-06-slice-2c-ui-polish.md](docs/superpowers/plans/2026-06-06-slice-2c-ui-polish.md)（subagent-driven 執行，每片兩段 review）

**登入流程**

- [x] `LoginPage` 套 design tokens + CSS Modules：置中卡片版型、紙感背景與主畫面一致
- [x] 驗證碼改為「核對碼」呈現：等寬字體、放大、加字距（device flow 用 `verification_uri_complete`，碼是核對用不是輸入用，**不做複製**）
- [x] 「在 WSPC 開啟授權頁 ↗」改 primary 樣式（styled `<a>`，因 `Button` 無 render/asChild 支援故用 `.primaryLink` class）
- [x] polling 狀態視覺化：pending spinner；`denied` / `expired` / `error` 各自狀態色 + 文案 + 重試（三者共用「重新發起 device flow」函式，各自 label）；狀態區加 `aria-live`
- [x] `AuthMenu`：未登入「登入 WSPC」做成 primary 連結；已登入 avatar + display_name → dropdown（email / 主題 / 登出）
- [x] 主題切換移進已登入 menu；未登入時獨立留在 TopNav `.actions`
- [x] loading 過場：`status === "loading"` render null，不讓 header 跳動
- [x] Mobile：窄視窗登入卡片不溢出、header 登入狀態排版正常

**Today 互動**

- [x] 優先權改 dropdown 選取（取代 `+→1→2→3→無` 循環）：直接選 ①②③ / 移除，`menuitemradio` 語意；選到被佔位子由 store 自動騰位
- [x] 計畫外 ⇄ 計畫內雙向切換：行尾 ✎🗑 連同「移到計畫內 / 標為計畫外」收進單一 ⋯ overflow menu，底層 toggle `is_adhoc`（含 worker PATCH 補 `is_adhoc` 寫入路徑）
- [x] Touch：行尾動作改用 `@media (hover: hover)` 偵測（無 hover 裝置常駐顯示），取代寬度斷點；menu 觸控目標 ≥44px
- [x] 一週改星期日開始（`weekOf` 回傳 Sun–Sat）

**新增的共用元件**：`src/ui/Menu`（包 `@base-ui/react` menu，支援 action 模式與 `selectedKey` 單選模式）。

**驗收**：231 自動化測試 + app/worker 型別全過；手動 preview 驗收（含使用者協助 WSPC 登入）對照設計文件「驗收標準」1–10 逐項通過（touch 常駐以 CSS 程式碼審查佐證）。
**不做**：auth 邏輯 / KV / token / todo 資料模型；Top3Card 行尾仍為 ✎🗑（與 TaskRow 的 ⋯ menu 不一致，留待後續統一）。

### Slice 3 — Monthly 欄互動 + promote ⏳

**目標**：把 Monthly 欄從唯讀變可寫;跨欄 promote 手感。

> Monthly 欄的視覺(包含本月 Top3 hero、其他計劃內、計劃外、軌跡列)已在 Slice 0 完成,這片補互動。

- [ ] 「Monthly +」加入點:寫入 `scheduled_months = [本月]`、`scheduled_dates = []`
- [ ] 月份切換器(`/plan/2026-05` route param,或 month picker)
- [ ] `monthly_priority` 1/2/3 切換(點 ring / menu)
- [ ] 拖曳:Monthly → Selected Day(append `scheduled_dates`)
- [ ] Monthly 內 task 完成 / 編輯 / 刪除
- [ ] 淘汰 mock data 的 `parent_id`:月 / 日改以「同一個 task 跨層級」呈現(`scheduled_months` + `scheduled_dates`),取代 Slice 1 移除的「對應月度任務」chip

**不做**:軌跡的寫入語意、略過、carryover 動作。Plan 模式「選哪一天 promote」的日選取留到 **Slice 3.5**(這片 promote 暫時只能排到寫死的今天)。

> **實作差異(已完成,待 merge)**:第 4 項「拖曳」簡化成 MonthRow / 月度 hero 的 `⋯` menu「→ 排到選取日」按鈕(真實拖曳延到 Slice 7)。第 3 項 `monthly_priority` 在月度 hero 用 ring + dropdown,並補了 MonthRow 上的 ring 讓「其他計劃內 / 計劃外」的列也能設 priority(手動驗收時補的缺口)。

### Slice 3.5 — Plan 週導覽 + Day 欄可規劃 ✅

**完成**：route `/plan/$date`（焦點日進 URL）、Week 欄日格可點 + `‹ ›` 換週、Month `‹ ›` 改跳焦點日一個月、`DayColumn` 互動性與 variant 解耦讓 Plan Day 欄完全可規劃、Today→「專注」標籤改名。連帶修一個 latent bug：Focus 用 `/today/<非今天>` 檢視某日時，設優先權 / 新增原本誤 scope 到真實今天。

> 設計：[2026-06-07-slice-3.5-plan-week-day-design.md](docs/superpowers/specs/2026-06-07-slice-3.5-plan-week-day-design.md)・計畫：[2026-06-07-slice-3.5-plan-week-day.md](docs/superpowers/plans/2026-06-07-slice-3.5-plan-week-day.md)（subagent-driven 執行，每片兩段 review）。手動 preview 驗收對照設計「驗收標準」1–11 逐項通過。

**手動驗收後加的兩個細調**：
- **月任務 promote 可選名次**：`MonthRow` / `MonthHeroCard` 的 ⋯ 選單從單一「→ 排到 N 日」擴成「→ N 日 · ①/②/③ 三件事」+「→ N 日 · 其他」——排到某天時直接決定進當天三件事或其他（沿用 day ring 的擲位語意）。
- **Week 日格顯示「還有 n 件其他任務」**：週欄日格原本只顯示那天的三件事，排到「其他」的任務在週視圖看不到；現補一行計數，且「—」只在那天完全沒任務時才顯示。

**緣由**:手動驗收 Slice 3 時發現 Plan 模式有兩個相連的盲點:

1. **無法選哪一天 promote**:Plan 的選取日(`selectedDate`)在 [src/routes/plan.tsx](src/routes/plan.tsx) **寫死成真實今天**,且 [src/features/week/WeekColumn.tsx](src/features/week/WeekColumn.tsx) 日格唯讀不可點。promote 永遠只能排到今天,挑不了「本週的星期三」。「Selected Day」這概念從 Slice 0 起被假設存在、卻沒任何片實作。
2. **排到某天後無法在 Plan 裡排那天的每日三件事**:Plan 的 Day 欄是 `plan-narrow` **唯讀**(`interactive = variant === "today-hero"` 把互動性跟版型綁死),沒有 ring、不能設 `daily_priority`、不能勾完成。要設每日三件事得切到 Focus tab 才行——規劃動線被切成兩個 tab。

**Plan 與 Focus 的本質區分(產品脈絡,兩 tab 非冗餘,是同資料的兩種鏡頭)**:

| | **Plan(規劃)** | **Focus(專注於某日,現叫 Today)** |
|---|---|---|
| 何時用 | 每週開始的儀式 | 每天執行時 |
| 心智尺度 | **多尺度**:月 / 週 / 日同等並列 | **單尺度**:某日放大成 hero,月 / 週降權為輔助 |
| 目的 | 把大範圍(月)工作往下排到這週、某幾天 | 焦點鎖在那天該做的事,不被大範圍任務分心 |

→ Focus 刻意把大尺度資訊**降權**(執行畫面)、Plan 刻意**升權**(規劃畫面);同樣的互動能力、不同的視覺權重與時機。**Focus 現有版型(Day hero + 兩側輔助)已符合,不動。**

**月度三件事 vs 每日三件事**:`monthly_priority`(整月最重要 3 件,從 ~10+ 挑,Month 欄設)與 `daily_priority`(某天最重要 3 件,各天獨立,**該天的 Day 欄設**)是兩個獨立欄位、獨立排名。「排到某天」與「設那天三件事」是兩個都要做的動作。

**最終模樣(完成形)**:三欄 Month / Week / Day 是同一個「**焦點日**」的三種視角,單一真實來源,且 Plan 的 Day 欄完全可互動:

- 焦點日(預設今天)放 URL,可書籤:route 從 `/plan/$month` 改為 `/plan/$date`(path param,與 `/today/$date` 一致);月份由 `monthOf(date)` 推導。
- **Week 欄 = 主導覽**:顯示焦點日那一週;日格可點(移焦點到該天);加 `‹ ›` 換週。
- **Day 欄 = 焦點日,且完全互動**:設 `daily_priority`(每日三件事 ring)、勾完成、編輯、刪除、新增——與 Focus 的 Day 欄**同等能力**。
- **Month 欄 = 焦點日所屬月**:`‹ ›` 改為焦點日跳一個月。

**本片範圍**:

- [ ] route `/plan/$month` → `/plan/$date`(焦點日;month 推導;`beforeLoad` 驗 `YYYY-MM-DD`)
- [ ] `WeekColumn` 日格可點 → 設焦點日(改 route)
- [ ] `WeekColumn` 加 `‹ ›` 換週(焦點日 ±7 天)
- [ ] **`DayColumn` 互動性與 variant 解耦**:加獨立 `interactive` prop,`plan-narrow` 也能互動但維持窄版視覺
- [ ] **Plan 的 Day 欄改為互動**:每日三件事 ring + 勾完成 + 編輯 + 刪除 + 新增
- [ ] Day 欄 + promote 目標皆跟焦點日
- [ ] Month 欄改由焦點日推導月份;`‹ ›` 改為跳月
- [ ] `selectedDate` 不再寫死今天

**待定(實作時再拍板)**:Today tab 改名 **Focus / 專注**——因 `/today/$date` 能 focus 任一天,「今天」名實不符;純標籤 + 文案。

**做完後的細調(只能做完看結果才知道)**:上面兩個重點(週導覽 + Day 欄可規劃)完成、實際用一輪後才會浮現的小工作——例如三欄在 Plan 的視覺權重微調、選日 / 換週手感、promote 後焦點要不要自動跳到該日等。這些等做完再列。

**設計決策(為何不做「獨立、限本週」小版本)**:曾考慮讓「選取日」與「月份」各自獨立、限本週可選。但最終是「月 / 週 / 日繞單一焦點日耦合」,獨立版會變技術債、之後得打掉重做,不是乾淨子集。週為主完整模型只比「讓日格可點」多一個「Week `‹ ›` 換週」,故直接做完整版。

**延後到 Slice 7 打磨**:跳回今天按鈕、過場動畫、鍵盤導覽、**真實拖曳**(把 Monthly / Backlog row 拖放到某天,取代按鈕式 promote)。

**不做**:跨月遠期日的特別處理——遠期留月層,該週到了再排日,符合「日層排程是近期」的節奏。

### Slice 4 — Plan 模式完整拖曳 + Backlog 互動 ✅

**完成**:Backlog 從唯讀變可寫,並把 Plan 模式做成**完整的拖曳重排**(範圍比原規劃大 —— 原本只做 backlog、真實拖曳延到 Slice 7,brainstorm 後決定一次做完)。

> 設計:[2026-06-08-slice-4-plan-drag-design.md](docs/superpowers/specs/2026-06-08-slice-4-plan-drag-design.md)・計畫:[2026-06-08-slice-4-plan-drag.md](docs/superpowers/plans/2026-06-08-slice-4-plan-drag.md)(subagent-driven 執行,每組兩段 review;手動 preview 對真實 WSPC 逐項驗收)。

**核心決策 —— Plan / Focus 語意分流**:把「拖到別天」依模式分成兩套語意。**Plan(規劃)= 乾淨重排**(決定哪天做,改主意不留軌跡);**Focus(專注)= 順延**(沒做完 → append + 留軌跡),Focus 那套留給 Slice 5 / 6。

- [x] Backlog 寫入:新增(空 `scheduled_*`、`is_adhoc:"false"`)、完成、編輯、刪除(`BacklogRow` + `AddBacklogTaskInput`,取代 Slice 0 誤用 day `TaskRow` 的唯讀渲染)。
- [x] `planScheduleDay`(Plan「排到某天」單一真實來源):已有 primaryDate → **替換 `scheduled_dates` 最後一筆**(重排,保留較早真實軌跡);否則 append;兩者都**補本月**(`monthOf(date)` 進 `scheduled_months`)。
- [x] 桌機拖曳(`@dnd-kit/core`):來源 = Backlog / 月列 / Day 欄列 / **Week 日格 top-3 任務**;放下區 = Month 區、Day 欄(三件事 / 其他子區)、Week 每個日格(三件事 / 其他子區)。drop 高亮、`DragOverlay` ghost、樂觀更新 + 失敗回滾。
- [x] 裝置分流:桌機拖曳 + `⋯` menu;手機(Plan tab 化)只 menu(`useHoverCapable` 對 `(hover: hover)` 偵測)。
- [x] `⋯` menu promote(手機 + 桌機 fallback):backlog →本月 / →焦點日·①②③/其他;月列沿用 →N日·名次。
- [x] `is_adhoc` 預設依「加入點預設值」表(backlog+ → `false`,promote 不動)。

**實作中的設計修正**:
- **不掛 `KeyboardSensor`**:自由形式 drop zone 沒有客製 `coordinateGetter` 時鍵盤拖曳無效、又讓列變 focusable 誤導;鍵盤無障礙改走完全可鍵盤操作的 `⋯` menu。
- **Week 日格改「單一 droppable + 垂直 Y-split」**:每格兩個 ~20px 貼鄰子區對 dnd-kit 碰撞極不可靠(同格短拖時 rectIntersection / pointerWithin / closestCenter 全部解析錯或解不到,導致「重要 → 其他」降級拖不動,手動驗收抓到)。改成每格一個大 droppable,top-3 / 其他由放下點落在 cellBody 上半 / 下半決定;拖曳中不增刪內容以免版面位移把放下區移走。
- **所有欄位的 draggable id 命名空間化**(`month:` / `day:` / `week:<date>:`):同一焦點日任務會同時出現在 Day 欄、Month「其他計劃內」、Week 格,原本 Day / Month 都用 bare `task.id` → dnd-kit 撞 id、把焦點日任務的拖曳整個搞壞(甚至卡死渲染器)。`resolveTaskId` 還原真實 id。
- **Week 日格的「其他」任務改渲染成可拖項目**(取代 Slice 3.5 的「還有 n 件其他任務」計數):否則無法在週格抓「其他」任務往上拖。現在週格內可雙向拖曳——其他 → 三件事(升級)、三件事 → 其他(降級)。
- **`nextFreeDailySlot` 排除被拖任務**:重排已有名次的任務到別天時,不讓它把自己舊名次算進空位(否則落 ② 而非 ①)。

**不做(留後續)**:日 → 月「降級 / 丟回月」(task 排到某天已補本月、仍在 Month 欄,真正的丟回月留 **Slice 6**);Focus 模式順延拖曳(**Slice 5 / 6**);手機 day↔day 重排(桌機拖曳限定);同欄拖曳排序(`position`,**Slice 7**)。

### Slice 5 — Dismiss / Unschedule(實寫入)⏳（部分完成 2026-06-13）

**目標**:讓「拖延」與「略過」可實際發生並影響資料。

> Primary vs trail 的推導(`primaryDate` / `primaryMonth` / `tasksOnDate` / `tasksOnMonth`)以及三種樣式(primary / forwarded / dismissed)的渲染已在 Slice 0 完成 — 但目前只是讀 mock 渲染,沒有寫入動作。這片補上實際寫 `unscheduled_*` 的 UI 路徑。

**已完成（2026-06-13）**：Focus 日層級「丟回月度」動作（Focus tab 每列 `⋯` menu）：
- [x] 「丟回月度」寫入 `unscheduled_at = 該任務所在日期`，確保本月仍在 `scheduled_months`（若尚未含本月則 append），清除 `daily_priority`；BFF PATCH 路由也已補上 `unscheduled_at` 的持久化。
- [x] dismissed trail 標籤由「· 已略過」改為「· 退回月度」。
- [x] 「丟回月度」只在非 today 的日期檢視時顯示。

> 注意：原 spec 稱「略過按鈕」，實際 ship 的是「丟回月度」（寫 `unscheduled_at`）；bare「略過」按鈕（只寫 `unscheduled_at`、不保留月度歸屬）**未建置**。
>
> 相關 spec / plan：[docs/superpowers/specs/2026-06-13-focus-carryover-actions-design.md](docs/superpowers/specs/2026-06-13-focus-carryover-actions-design.md)、[docs/superpowers/plans/2026-06-13-focus-carryover-actions.md](docs/superpowers/plans/2026-06-13-focus-carryover-actions.md)

**尚未完成**：
- [ ] 丟回 Backlog 按鈕(月層級):寫入 `unscheduled_month = last(scheduled_months)` 同時 `unscheduled_at = today`
- [ ] 移到下月按鈕:`scheduled_months.push(next_month)`
- [ ] forwarded / dismissed trail row 的互動:只能勾完成(其他動作 disabled),確認 Slice 0 渲染邏輯仍正確
- [ ] 完成 trail task 後 `done_on` 寫入 + UI 切換到 ✓ 完成樣式

**不做**:carryover banner 的動作(下一片)。

### Slice 6 — Carryover banner 動作 + 月底 Review ⏳（部分完成 2026-06-13）

**目標**:把「打開新一天 / 新一月」的入口流程實際接起來。

> Banner 的視覺已在 Slice 0 完成(靜態示意),這片把 carryover 判定 + 三個動作按鈕接起來。

**已完成（2026-06-13）**：Focus 日層級「移到今天」per-row 動作（Focus tab 每列 `⋯` menu，非 banner）：
- [x] 「移到今天」：`scheduled_dates.push(today)`（append-only，保留原來的日期做為順延軌跡）；若 today 三件事有空位則 `daily_priority` reassign 到空位，否則清除。
- [x] 「移到今天」只在非 today 的日期檢視時顯示。

> 注意：這是 **per-row** 動作，**非** carryover banner 上的批次動作；banner 動作**尚未建置**。「移到其他日期」也**未建置**。
>
> 相關 spec / plan：[docs/superpowers/specs/2026-06-13-focus-carryover-actions-design.md](docs/superpowers/specs/2026-06-13-focus-carryover-actions-design.md)、[docs/superpowers/plans/2026-06-13-focus-carryover-actions.md](docs/superpowers/plans/2026-06-13-focus-carryover-actions.md)

**尚未完成**：
- [ ] 日 carryover 判定(前端 client-side filter):
  ```
  scheduled_dates.length > 0
    AND last(scheduled_dates) < today
    AND last(scheduled_dates) > (unscheduled_at ?? "")
  ```
- [ ] 日 carryover banner 動作:「→ 三件事 / → 計劃內 / 略過」三動作真的寫入 store
- [ ] 「移到其他日期」動作（per-row）
- [ ] 月 carryover 判定:
  ```
  scheduled_months.length > 0
    AND last(scheduled_months) < current_month
    AND last(scheduled_months) > (unscheduled_month ?? "")
    AND 沒有 today 在 scheduled_dates
  ```
- [ ] 月 carryover banner 動作:「→ 本月最重要三件事 / → 本月其他任務 / 丟回 backlog」
- [ ] 月底 Review 介面(逐筆處理本月未完成 task)
- [ ] Banner 只在實際有 carryover 時顯示(Slice 0 是 hard-coded 永遠顯示)

### Slice 7 — 排序、`is_adhoc` 染色、打磨

**目標**：v1 收尾的細節調整。

- [ ] `position` 欄位（lex-order）+ 同欄拖曳排序
- [ ] `is_adhoc` 染色規則：
  - 月度欄：`is_adhoc = true` → 紅 chip（月中膨脹提醒）
  - 日欄：`is_adhoc = true` AND `created_at == today` AND `scheduled_dates 只有 today` → 紅 chip
- [ ] 鍵盤快捷鍵、空狀態文案、loading / error 細節
- [ ] 一輪整體使用後的回頭調整

---

## 📦 共用參考：資料模型 (Data Model)

採用 **三層漏斗** 模型，所有層級共用同一個 WSPC `DeskTask` 型態，差別只在 custom fields。**月與日兩層採對稱結構**（都用 `scheduled_*` array + `unscheduled_*` 標記目前歸屬）：

```
Backlog  (scheduled_months 空，或 last <= unscheduled_month)
   ↓ promote 進某個月（append 到 scheduled_months）
Monthly  (last(scheduled_months) > unscheduled_month，且 scheduled_dates 空或已 unscheduled)
   ↓ schedule 到某天（append 到 scheduled_dates）
Daily    (last(scheduled_dates) > unscheduled_at)
```

同一個 task 可以同時出現在月度欄與日欄（月度欄採 α 模式：顯示所有目前歸屬本月的 task，含已排到某天的）。

### Custom Fields 清單

| Field | 型別 | 用途 |
|---|---|---|
| `scheduled_months` | string_array | 該 task **曾經被排到的月份**（`"YYYY-MM"`）；**永不 remove**，移月 = append。陣列長度 = 跨月拖延次數 |
| `scheduled_dates` | string_array | 該 task **曾經被排定的日期**（`"YYYY-MM-DD"`）；同樣 append-only。陣列長度 = 跨日拖延次數 |
| `unscheduled_month` | string | 最後一次「從月度移走 / 丟回 backlog」的月份（`"YYYY-MM"`） |
| `unscheduled_at` | string | 最後一次按「略過 / 從某天移走」的日期（`"YYYY-MM-DD"`） |
| `monthly_priority` | string | `"1"` / `"2"` / `"3"`，該月最重要三件事的順序 |
| `daily_priority` | string | `"1"` / `"2"` / `"3"`,當日最重要三件事的順序 |
| `is_adhoc` | string | `"true"` / `"false"`，task 進清單時是否為臨時插單 |
| `done_on` | string | 完成時的 ISO 時間；前端 PATCH `status: "done"` 時同步寫入 |
| `position` | string | （Slice 7+）同欄拖曳排序用，lex-order 字串 |

**不使用 WSPC 核心 `due_at`** —— task 排定日期完全用 `scheduled_dates` 表達。

**WSPC `status` enum** 為 `open / in_progress / done / cancelled`；下文「未完成」均指 `status ∈ {open, in_progress}`。

### 加入點預設值

| 加入點 | scheduled_months | scheduled_dates | is_adhoc |
|---|---|---|---|
| Backlog + | `[]` | `[]` | `false` |
| Monthly + | `[本月]` | `[]` | 使用者 toggle，預設 `false`（月初規劃）/ `true`（月中追加） |
| Today + | `[]` | `[today]` | `true` |
| Backlog → 拉到 Monthly | append 本月 | (維持) | `false` |
| Backlog/Monthly → 拉到 Today | (維持/append 本月) | append today | `false` |

### 軌跡顯示規則

每個 view（某天 / 某月）顯示**所有** `scheduled_*` 內含該日/該月的 task，並依該 entry 是否為 `last` 區分樣式：

| 樣式 | 條件 | 互動 |
|---|---|---|
| **primary（一般 row）** | 該日 == `primaryDate`（或月份 == `primaryMonth`） | 完整互動（編輯、略過、刪除、勾選） |
| **順延軌跡** | 該日在 array 內，但 `last` 比它新 → 已順延到後面 | 唯讀；可勾選完成（同一 entity） |
| **略過軌跡** | 該日 == `last` AND `last == unscheduled_at` → 在這天被略過 | 唯讀；可勾選完成 |

完成後（`status = "done"`）：`done_on` 之前的軌跡仍顯示為順延樣式，`done_on` 那天顯示為「✓ 完成」。月份軌跡規則完全對稱。

---

## 📅 第二階段：Calendar 整合（後續擴充）

結合 WSPC Calendar API，將行事曆融入個人儀表板中。同樣以垂直切片方式推進，但細節待第一階段完成後再規劃。

- [ ] **BFF API Key 代理**：由於 Calendar API 目前僅支援 API Key，將 API Key 加密存放於 Cloudflare KV/變數，由 Worker 代理所有 Calendar 請求。
- [ ] **行事曆視覺化**：Dashboard 中提供月曆 (Month View) 與日曆檢視 (Schedule View)。
- [ ] **任務與行事曆整合**：將排定日期的 task 投射在行事曆上，或在行事曆上直接新增 task。

---

## ✉️ 第三階段：Mail 整合（後續擴充）

整合 WSPC Email API，讓儀表板成為完整的個人控制台 (Desk)。

- [ ] **郵件收發介面**：收件匣 / 寄件匣 / 寫信視窗，支援 WSPC `@wspc.app` 收發。
- [ ] **別名 (Alias) 管理**：支援 WSPC API 的 alias 設定與寄件者別名選擇。
- [ ] **郵件轉任務**：一鍵把信件轉為 `DeskTask`（指派 `scheduled_months` 或 `scheduled_dates`），完成生產力閉環。
