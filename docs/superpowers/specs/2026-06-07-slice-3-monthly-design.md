# Slice 3 — Monthly 欄互動 + promote 設計

> 對應 ROADMAP「Slice 3 — Monthly 欄互動 + promote」。把 Monthly 欄從唯讀變可寫，並把資料載入改成 client 端 derive（方案 A），讓本片與後續 slice 都能跨月跨日看資料。

## 目標

- Monthly 欄可寫：`Monthly +` 加入點、`monthly_priority` 切換、promote（按鈕：排到選取日）、Monthly 列完成 / 編輯 / 刪除。
- 月份切換 `/plan/$month`。
- 淘汰 mock data 與型別中的 `parent_id`。
- 資料載入改成方案 A：BFF 一次回該使用者所有非 cancelled task，月 / 週 / 日 / backlog 全部用既有 client 端 derivation 拆。

## 不做（守住 ROADMAP 邊界）

軌跡寫入語意、略過、carryover 動作、真實拖曳（延到 Slice 7）、Backlog 寫入（Slice 4）。

---

## WSPC OpenAPI 調查結論（已查線上最新版）

入口 `https://wspc.ai/llms.txt` → todo 規格 `https://api.wspc.ai/todo/openapi.json`（線上最新，為最終真實來源）。針對 `todo_list` / `UpdateTodoBody` 查證如下，作為本片 BFF 改動依據：

1. **`cf.<key>` 自訂欄位過濾「線上最新版已正式文件化」**（與 repo 內 `spec/wspc-openapi.json` 那份描述未提 `cf.` 不同——repo 那份已過時）。原文：「Custom-Field Filters (`cf.<key>=<value>`): Repeatable dynamic-prefix query parameters... for `string_array` custom fields the match is positive when the array contains the value.」即 Slice 2b 用的 `cf.scheduled_dates` array-contains 現在是**官方支援、非脆弱**；`cf.scheduled_months` 同理可用。

   > 但這**不改變方案 A 的選擇**。方案 A 站得住腳的理由不是「繞開未文件化路徑」，而是：(a) client derivation（`tasksOnMonth` / `tasksOnDate` / `tasksInBacklog`）Slice 0 已寫好且測過；(b) 下游 slice（Backlog / 軌跡 / carryover）本來就要跨月跨日看資料，client 載入讓它們零 BFF 改動；(c) 切月即時 re-derive 不 refetch；(d) `cf.` 只能 array-contains，**仍無法表達**「Week 欄整週的 adhoc task（`scheduled_months` 為空者不會 match 月查詢）」與「scheduled 落在某月的 range」——server 端過濾蓋不到 Week 欄正確性。

2. **list 文件化 query 參數**：`project_id`（必填）、`user_id`、`parent_id`、`status`（多值）、`include_deleted`、`include_templates`、`due_after` / `due_before`、`type_id`、`sort_by` / `order`、`include_orphan_fields`，外加動態 `cf.<key>`。方案 A 改用 `project_id` + `status`（多值）+ 可選 `type_id`，皆文件化。
3. **list 省略 `parent_id` 時預設只回 root-level todo**。我們的 DeskTask 一律 root-level（不設 `parent_id`），所以預設 list 會回全部——也佐證該淘汰 `parent_id`。
4. **`UpdateTodoBody.custom_fields` 的 PATCH 語意**（線上與 repo 版一致）：只有出現在 map 裡的 key 會變；傳 `null` 刪該欄；**陣列值整欄替換、無 element-level diff**；未宣告 key 回 `UNDECLARED_FIELD`。`scheduled_months` / `scheduled_dates` / `monthly_priority` 在 Slice 2b 的型態註冊已一次宣告完，皆可 patch。promote = client 算好整個 `scheduled_dates` 陣列再整欄 PATCH，與此語意相容。
5. list **沒有**「scheduled 落在某月」的 server 端 range 能力（只有 `due_at` 半開窗 `[due_after, due_before)`，且我們不用 `due_at`），故 client 端 derive 是唯一能正確涵蓋月 / 週 / 日的路徑。
6. 可選強化：list 帶 `type_id`（bootstrap 已有 typeId）把範圍鎖在 DeskTask 型態，避免同 project 內其他型態混入。

> 附帶：repo 內 `spec/wspc-openapi.json` 相對線上已過時（缺 `cf.<key>` 文件）。更新它不屬於本片範圍，另案處理。

---

## 方案 A：資料載入改造（影響最深）

### 現況

`loadTasks(date)` → `GET /api/todo?date=` → worker 用 `cf.scheduled_dates` 過濾，只回該日 task；store 的 `today` 被設成「被檢視的日期」。Plan mode 的 Monthly 欄因此拿不到「本月歸屬」的 task。

### 改成

**BFF / wspc（`worker/wspc.ts`、`worker/routes/todo.ts`）**

- `listTodos` 拿掉 `cf.scheduled_dates` 過濾，改成只帶 `project_id` + `status=open,in_progress,done`（**省略 cancelled** = soft-delete 隱藏），可選帶 `type_id`。一次回該使用者所有非 cancelled task。
- `handleListTodo` 不再要求 / 驗證 `date` query 參數。
- `CF_SCHEDULED_DATES` 常數與 `scripts/verify-wspc.mjs` 對應檢查功成身退（移除或標記 deprecated）。

**store（`src/store/tasks.ts`）**

- `loadTasks()` 不再吃 `date`，改 **load-once**：`status` 不是 `ready` / `loading` 才實際載入。
- `today` 改回「真實今天」`todayISO()`，與「被檢視日期」解耦。`setDailyPriority` 的騰位仍以真實 `today` 為界，語意不變。
- `fetchTodos` 簽章從 `fetchTodos(date)` 改為 `fetchTodos()`（不帶 query）。

**view（`src/routes/today.tsx`、`src/pages/PlanPage.tsx` 及對應 route）**

- `selectedDate`（Today）、`selectedMonth`（Plan）改成純 route 參數。
- 切日 / 切月只 **re-derive** 既有 `tasksOnDate` / `tasksOnMonth` / `tasksInBacklog`，**不 refetch**。
- `TodayView` 的 `useEffect(loadTasks, [date])` 改成 load-once（不依賴 date）；Plan view 同樣 load-once guard。

> ⚠️ 這段動到 Today 的載入路徑與 `src/store/tasks.test.ts` → 依 CLAUDE.md **要連 e2e 一起重跑回歸 Today**。

---

## BFF / wspc 其餘改動

### create 泛化（`worker/routes/todo.ts`、`worker/wspc.ts`、`src/lib/api/todo.ts`）

`handleCreateTodo` 目前寫死 `scheduled_dates=[date], is_adhoc="true"`。改成依加入點組 custom_fields：

| 加入點 | scheduled_dates | scheduled_months | is_adhoc |
|---|---|---|---|
| `today`（既有） | `[date]` | — | `"true"` |
| `month`（新增） | — | `[month]` | `"false"` |

前端 `postTodo` 改傳明確 add-point 欄位（例：`{ title, scheduled_dates?, scheduled_months?, is_adhoc? }`），worker 直接採用組裝 custom_fields。

### patch 擴充（`worker/routes/todo.ts`、`worker/wspc.ts`、`src/lib/api/todo.ts`）

- `TodoPatch` / `handlePatchTodo` body / `patchTodoApi` 加：`monthly_priority?: string | null`、`scheduled_dates?: string[]`、`scheduled_months?: string[]`。
- `worker/wspc.ts` 的 `patchTodo` customFields 型別從 `Record<string, string | null>` 放寬為 `Record<string, string | string[] | null>`。
- `todoQueue` 以 id 合併、後到 patch 覆蓋同 key；陣列當整值替換，與既有 coalescing 相容（promote 直接覆寫整個 `scheduled_dates`）。

---

## 月份切換 route `/plan/$month`

- 鏡像 `/today/$date`：`/plan`（index）→ render 當月；`/plan/$month`（例 `/plan/2026-05`）顯式，`beforeLoad` 驗 `YYYY-MM` 不合法就 redirect 回 `/plan`。
- `src/lib/date.ts` 加 helper：`isValidMonthParam`（`^\d{4}-\d{2}$`）、`prevMonth` / `nextMonth`（跨年進位）。
- Monthly 欄 header 加 `‹ ›` stepper，連動改 route。
- `/plan` route 與 `PlanPage` 拆成 layout + 具體 view（鏡像 `today.tsx` 的 `TodayLayoutRoute` + `today.index.tsx` / `today.$date.tsx`）。

---

## Monthly 欄互動（選項 1：平行新建，不動 Today）

### 元件

- 新 `useMonthRow(id, { month, selectedDate })` hook，接月層 ops；層無關的 `toggle` / `edit` / `delete` / `adhoc` 直接共用既有 store action。
- `MonthRow`（`src/features/month/MonthRow.tsx`）從唯讀 → 互動，鏡像 `TaskRow` 結構：
  - Checkbox 可勾完成。
  - 行尾 `⋯` overflow menu：`編輯` / `刪除` / `↑ 移到計畫內`·`↓ 標為計畫外`（toggle `is_adhoc`）/ **`→ 排到 {選取日}`**（promote）。
  - trail kind（`forwarded` / `dismissed`）維持唯讀、只能勾完成（不變，沿用 Slice 0 渲染邏輯）。
- `MonthHeroCard`（`src/features/month/MonthHeroCard.tsx`）：本月 Top3 改互動——**不重用 Top3Card 的 daily 版**，在 month feature 內做月層版（避免動到 Today 的載重元件）：
  - `monthly_priority` 改 dropdown（鏡像 Today 的 `menuitemradio`：`① 本月第一` / `② 本月第二` / `③ 本月第三` / `— 移除`）。
  - 可勾完成、編輯、刪除、promote。

### 新 store ops（`src/store/taskOps.ts` 純函式 + `src/store/tasks.ts` action）

- `setMonthlyPriority(tasks, id, n, month)` — 鏡像 `setDailyPriority`，但騰位範圍 = `primaryMonth(t) === month` 的撞號者（清掉其 `monthly_priority`）。
- `promoteToDay(tasks, id, date)` — append `date` 到 `scheduled_dates`（已是 `last` 則 no-op）。
- `addMonthTask(tasks, title, month, id, now)` — `scheduled_months=[month]`、`is_adhoc="false"`。
- 對應 store action 走樂觀更新 + patch queue + 失敗回滾，與既有一致；`setMonthlyPriority` 失敗比照 `setDailyPriority` 用 `loadTasks()` reload 收斂（避免多筆 patch 部分成功留下不一致）。

---

## 加入點 `Monthly +`

- Monthly 欄底部加 `AddTaskInput`（重用既有元件），送 `addMonthTask`。
- `is_adhoc` 預設 `false`（月初規劃語意）；要標計劃外用既有 `⋯` menu 事後 toggle。
- 本片**不**在加入當下做 `is_adhoc` toggle UI（ROADMAP 預設表允許 toggle，這片先簡化為預設 `false` + 事後切換）。

---

## 淘汰 `parent_id`

- 移除：`src/lib/types.ts` 的 `Task.parent_id`、`src/mock/data.ts` 的 `parent_id`、`worker/todo-mapper.ts` 的 `parent_id: null`，及相關測試引用（`worker/todo-mapper.test.ts`、`src/store/tasks.test.ts` 等）。
- 月 / 日跨層由「同一 task 的 `scheduled_months` + `scheduled_dates`」表達（資料模型本來就這樣，此處只清殘留欄位）。

---

## 測試策略

### 自動化（vitest）

- `taskOps`：`setMonthlyPriority` 騰位、`promoteToDay`（append / no-op）、`addMonthTask`。
- `date.ts`：`isValidMonthParam`、`prevMonth` / `nextMonth`（跨年進位）。
- store：新 action 的樂觀更新 / 失敗回滾 / `setMonthlyPriority` reload 收斂；`loadTasks()` load-once 行為。
- worker：`handleListTodo`（全載、不要求 date）、`handleCreateTodo`（today / month 兩種加入點）、`handlePatchTodo`（`monthly_priority` / 陣列欄位）。
- `todo-mapper`：去 `parent_id`。

### e2e（Playwright，**必跑**）

> 改到 Today 載入路徑與 Today / Monthly 互動，依 CLAUDE.md 一定要跑 `npm run test:e2e`。

- Monthly 列動作（完成 / 編輯 / 刪除 / adhoc 切換）。
- promote 到選取日後，task 出現在 Day 欄。
- 月份切換（`‹ ›` stepper 改 route、`/plan/$month` 直接進）。
- `monthly_priority` 騰位。
- **回歸 Today 互動**（因動到載入路徑）。
- mock WSPC upstream 要補：跨月份、多 status（含 done）的資料，且 list 行為改為「回全部非 cancelled」。

### 手動（preview + AI agent）

- 由 AI agent 透過 `preview_start` 開預覽，對照下方「驗收標準」逐項操作驗證視覺與互動。
- 涉及 WSPC 登入時（device flow 要在 WSPC 端按 Approve），**請使用者協助完成登入**後再續跑。

---

## 驗收標準

1. 登入後進 `/plan`，Monthly 欄顯示本月所有歸屬 task（Top3 hero、其他計劃內、計劃外、軌跡），資料來自真實 WSPC。
2. `Monthly +` 新增 task：`scheduled_months=[本月]`、`scheduled_dates=[]`、`is_adhoc=false`，刷新後仍在。
3. Monthly 列可勾完成 / 取消、inline 編輯 title、刪除（soft-delete + undo）、計劃內 ⇄ 計劃外切換。
4. `monthly_priority` 用 dropdown 設 ①②③ / 移除；設到被占的位子時，原本占位者自動騰位（清掉其 `monthly_priority`）。
5. 對 Monthly 某 task 按「→ 排到 {選取日}」後，該 task 出現在 Day 欄（`scheduled_dates` append 選取日）；月欄仍依 α 模式顯示它。
6. `‹ ›` stepper 與 `/plan/2026-05` 直接進都能切月，切月不 refetch、即時 re-derive；重整保留月份。
7. 切到沒有 task 的月份顯示空狀態，不報錯。
8. Today mode 所有既有互動（完成 / 新增 / 編輯 / 刪除 / `daily_priority` / adhoc 切換 / 切日）完全不退化（e2e 全綠）。
9. 第二個 WSPC 帳號登入只看到自己的 task（multi-tenant 分流不變）。
10. 任一 mutation 失敗時 toast 提示且樂觀更新回滾（沿用既有錯誤路徑）。

---

## 主要風險

- **載入路徑改造波及 Today**：方案 A 改 store 載入合約，Today 已驗收 → 靠保留 `today` 語意 + e2e 回歸守住。
- **WSPC list 不帶 cf 過濾的實際回傳**：OpenAPI 已確認預設回 root-level 全部、`status` 多值過濾支援；上線前仍以 preview 對真實帳號實打一次，確認「只帶 `project_id` + `status` + `type_id`」確實回全部非 cancelled DeskTask。
