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
| Slice 1 — Today 互動 + localStorage | ⏳ 待開始 | — |
| Slice 2+ | ⏳ 規劃中 | — |

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

### Slice 1 — Today 互動 + localStorage ⏳

**目標**:在沒有 auth 噪音的情況下確認「最小可用單元」的 UX 與資料寫入流程。

> **跟原計畫的差異**:原本寫「單欄 Today」,但 Slice 0 已經把完整 Plan/Today 三欄版型都做出來了。Slice 1 改為直接把 Today mode 的 task 變成可互動,Plan mode 跟 Backlog 暫時還是唯讀。

- [ ] 引入 Zustand store(`useTasksStore`),取代直接 import mock data
- [ ] localStorage persistence(`zustand/middleware/persist`,key `desk.tasks`)
- [ ] Today mode 的 task:
  - [ ] 勾選完成(寫入 `status: "done"` + `done_on`)
  - [ ] 取消完成(`status: "open"`,清掉 `done_on`)
  - [ ] 新增任務(從「+ 加一件今天的事」入口,`scheduled_dates = [today]`、`is_adhoc = true`)
  - [ ] inline 編輯 title(雙擊或點 edit 進入)
  - [ ] 刪除(右鍵 menu 或行尾按鈕)
- [ ] `daily_priority` 1/2/3 切換(點 ring 切下一個值,或選單)
- [ ] 第一次載入時 seed mock data 進 store(只有當 store 是空的)
- [ ] Plan mode 的 task **仍唯讀**(下一片再開放),但要能正確讀 store

**可以看到什麼**:每日焦點的互動手感(完成動畫、空狀態、`is_adhoc` chip 怎麼出現),刷新後資料還在。
**不做**:WSPC、auth、Plan mode 的拖曳、Backlog 互動、軌跡的寫入。

### Slice 2 — 接上 WSPC（仍只有 Today）

**目標**：把最痛的基礎建設一次解掉，但範圍鎖在「一欄就好」。

- [ ] Cloudflare Workers + Wrangler Assets monorepo 結構
- [ ] Cloudflare KV 命名空間（dev / prod）+ `wrangler.toml`
- [ ] WSPC 動態 Client 註冊（Worker 啟動時自動完成，`client_id` 存 KV）
- [ ] BFF 認證路由：`/api/auth/login`、`/api/auth/status`、`/api/auth/logout`
- [ ] 加密 HttpOnly Cookie + Token 自動刷新中間件
- [ ] API 安全防護：僅 Owner (yurenju) 可存取 `/api/todo/*`
- [ ] WSPC `DeskTask` 自訂型態註冊（含完整 custom fields，雖然這片只用到一部分）
- [ ] `/api/todo` 端點：list / create / patch（status, daily_priority, done_on）
- [ ] 過濾條件先簡化：`scheduled_dates contains today`

**可以看到什麼**：Slice 1 的畫面換成真實 WSPC 資料；auth 鏈整條跑通。
**不做**：軌跡、略過、Monthly、Backlog。

### Slice 3 — Monthly 欄互動 + promote ⏳

**目標**：把 Monthly 欄從唯讀變可寫;跨欄 promote 手感。

> Monthly 欄的視覺(包含本月 Top3 hero、其他計劃內、計劃外、軌跡列)已在 Slice 0 完成,這片補互動。

- [ ] 「Monthly +」加入點:寫入 `scheduled_months = [本月]`、`scheduled_dates = []`
- [ ] 月份切換器(`/plan/2026-05` route param,或 month picker)
- [ ] `monthly_priority` 1/2/3 切換(點 ring / menu)
- [ ] 拖曳:Monthly → Selected Day(append `scheduled_dates`)
- [ ] Monthly 內 task 完成 / 編輯 / 刪除

**不做**:軌跡的寫入語意、略過、carryover 動作。

### Slice 4 — Backlog 互動 + 三層漏斗完整 ⏳

**目標**:完整漏斗,但仍是「只進不退」。

> Backlog 摺疊區的 UI + 展開互動已在 Slice 0 完成,Backlog 內容也已渲染。這片補寫入互動。

- [ ] Backlog +:寫入空 `scheduled_*`(完全沒有時間排定)
- [ ] 拖曳:Backlog → Monthly(append 本月到 `scheduled_months`)
- [ ] 拖曳:Backlog → Today/Selected Day(append today/該日到 `scheduled_dates`,必要時補本月)
- [ ] Backlog 內 task 完成 / 編輯 / 刪除
- [ ] 加入點 `is_adhoc` 預設值表(見「加入點預設值」表格)

**不做**:軌跡、略過、unschedule、carryover。

### Slice 5 — Dismiss / Unschedule(實寫入)⏳

**目標**:讓「拖延」與「略過」可實際發生並影響資料。

> Primary vs trail 的推導(`primaryDate` / `primaryMonth` / `tasksOnDate` / `tasksOnMonth`)以及三種樣式(primary / forwarded / dismissed)的渲染已在 Slice 0 完成 — 但目前只是讀 mock 渲染,沒有寫入動作。這片補上實際寫 `unscheduled_*` 的 UI 路徑。

- [ ] 略過按鈕(日層級):寫入 `unscheduled_at = today`
- [ ] 丟回 Backlog 按鈕(月層級):寫入 `unscheduled_month = last(scheduled_months)` 同時 `unscheduled_at = today`
- [ ] 移到下月按鈕:`scheduled_months.push(next_month)`
- [ ] forwarded / dismissed trail row 的互動:只能勾完成(其他動作 disabled),確認 Slice 0 渲染邏輯仍正確
- [ ] 完成 trail task 後 `done_on` 寫入 + UI 切換到 ✓ 完成樣式

**不做**:carryover banner 的動作(下一片)。

### Slice 6 — Carryover banner 動作 + 月底 Review ⏳

**目標**:把「打開新一天 / 新一月」的入口流程實際接起來。

> Banner 的視覺已在 Slice 0 完成(靜態示意),這片把 carryover 判定 + 三個動作按鈕接起來。

- [ ] 日 carryover 判定(前端 client-side filter):
  ```
  scheduled_dates.length > 0
    AND last(scheduled_dates) < today
    AND last(scheduled_dates) > (unscheduled_at ?? "")
  ```
- [ ] 日 carryover banner 動作:「→ 三件事 / → 計劃內 / 略過」三動作真的寫入 store
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
