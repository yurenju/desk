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

---

## 🚀 第一階段：Todo 個人工作流（垂直切片）

### Slice 0 — 純前端骨架（無資料、無 auth）

**目標**：把視覺與版型先做出來，在沒有任何後端干擾下確認 token 與設計。

- [ ] Vite + React + TS 專案初始化
- [ ] 安裝 [Base UI](https://base-ui.com) (`@base-ui/react`) + CSS Modules + CSS Custom Properties（**不**使用 Tailwind / shadcn，理由見 [HANDOFF.md](docs/claude-design/design_handoff_desk/HANDOFF.md) §2）
- [ ] Design tokens 依 HANDOFF §4 寫入 `src/tokens/*.css`
- [ ] 三欄版型（Backlog / Monthly / Today）寫死 mock data
- [ ] 跑在 `vite dev`，不需要 Worker

**可以看到什麼**：視覺、間距、字體、token 對不對。
**不做**：拖曳、編輯、Worker、WSPC。

### Slice 1 — 單欄 Today，localStorage 跑通互動

**目標**：在沒有 auth 噪音的情況下確認「最小可用單元」的 UX。

- [ ] 只渲染 Today 一欄
- [ ] 新增 / 勾完成 / 刪除
- [ ] `daily_priority` 1/2/3 chip 切換
- [ ] 資料存 localStorage

**可以看到什麼**：每日焦點的互動手感（chip 怎麼點、完成動畫、空狀態）。
**不做**：Backlog、Monthly、拖曳跨欄、軌跡。

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

### Slice 3 — 加上 Monthly 欄與 promote

**目標**：跨欄拖曳手感、月度規劃視覺密度。

- [ ] Monthly 欄渲染：過濾 `cf.scheduled_months contains 本月`
- [ ] 月份篩選器
- [ ] `monthly_priority` 1/2/3 區塊
- [ ] 拖曳：Monthly → Today（append `scheduled_dates`）
- [ ] 「Monthly +」加入點：`scheduled_months = [本月]`、`scheduled_dates = []`

**不做**：軌跡（先全部當 primary 看）、略過、carryover。

### Slice 4 — Backlog 欄 + 三層漏斗完整

**目標**：完整漏斗，但仍是「只進不退」。

- [ ] Backlog 摺疊區（預設摺疊，標頭 `📥 Backlog (N)`）
- [ ] Backlog +：`scheduled_months = []`、`scheduled_dates = []`
- [ ] 拖曳：Backlog → Monthly（append 本月）
- [ ] 拖曳：Backlog → Today（append today，必要時 append 本月）
- [ ] 「Today +」加入點：`scheduled_dates = [today]`、`is_adhoc = true`
- [ ] Monthly 加入點的 `is_adhoc` toggle

**不做**：軌跡、略過、unschedule、carryover。

### Slice 5 — Dismiss / Unschedule / 軌跡顯示

**目標**：把「拖延」與「略過」的視覺呈現做出來，這裡最容易要改設計，獨立成一片。

- [ ] `unscheduled_at` 寫入（日層級略過）
- [ ] `unscheduled_month` 寫入（月層級丟回 backlog）
- [ ] primary vs 軌跡的前端推導：
  ```
  primaryMonth = last(scheduled_months) if last > unscheduled_month else null
  primaryDate  = last(scheduled_dates)  if last > unscheduled_at    else null
  ```
- [ ] 三種樣式渲染：primary row / 順延軌跡（唯讀，可勾完成）/ 略過軌跡（唯讀，可勾完成）
- [ ] 完成後（`status = done`）軌跡樣式規則
- [ ] 「移到下個月」：`scheduled_months.push(next_month)`

**不做**：carryover banner（下一片）。

### Slice 6 — Carryover banner（日 + 月）

**目標**：把「打開新一天 / 新一月」的入口流程串起來。

- [ ] 日 carryover 判定（前端 client-side filter）：
  ```
  scheduled_dates.length > 0
    AND last(scheduled_dates) < today
    AND last(scheduled_dates) > (unscheduled_at ?? "")
  ```
- [ ] 日 carryover banner：「→ 三件事 / → 計劃內 / 略過」三動作
- [ ] 月 carryover 判定：
  ```
  scheduled_months.length > 0
    AND last(scheduled_months) < current_month
    AND last(scheduled_months) > (unscheduled_month ?? "")
    AND 沒有 today 在 scheduled_dates
  ```
- [ ] 月 carryover banner：「→ 本月最重要三件事 / → 本月其他任務 / 丟回 backlog」
- [ ] 月底 Review 介面（逐筆處理本月未完成 task）

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
