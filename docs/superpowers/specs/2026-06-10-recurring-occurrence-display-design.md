# Recurring occurrence 自動排入每日 —— 設計文件

日期:2026-06-10

## 背景與問題

Desk 跑在 WSPC todo service 上。WSPC 的 recurring rule(`todo_rule_*`)會把一條規則 materialize 成往後約兩週、每天一筆的獨立 todo（occurrence）。每個 occurrence 帶三個 WSPC 原生欄位:

```jsonc
{
  "title": "每日例行",
  "recurring_template_id": "tod_...",        // 指向隱藏的 template
  "recurrence_occurrence_at": "2026-06-10",  // 這筆 occurrence 屬於哪一天
  "due_at": "2026-06-10"
  // 注意:沒有 custom_fields，更沒有 scheduled_dates
}
```

Desk 判斷一筆 task 落在哪一層（backlog / monthly / daily）只看自家的 custom field `scheduled_dates`，完全忽略 WSPC 原生的 `recurrence_occurrence_at` / `due_at`:

1. [worker/todo-mapper.ts](../../../worker/todo-mapper.ts) 的 `mapTodoToTask` 把 WSPC todo 轉成前端 `Task` 時只搬 `custom_fields`，原生日期欄位被整個丟掉。
2. [src/lib/tasks.ts](../../../src/lib/tasks.ts) 的 `primaryDate()` 只讀 `custom_fields.scheduled_dates` → recurring occurrence 沒這欄位 → 回 `null` → `layer()` 判成 `backlog`。

結果:某個每日 recurrence rule materialize 出的 15 筆「每日例行」occurrence（2026-06-09 ~ 06-23）全部擠進 Backlog，而不是各自落到它該在的那一天。

## 目標

讓每個 recurring occurrence 用自己的 `recurrence_occurrence_at` 自動排進當天，呈現為該天的「**其他計劃內**」任務（不佔三件事），且不再積在 backlog。

## 範圍

**處理:** 只處理帶 `recurrence_occurrence_at` 的 recurring occurrence。

**不處理:** 一般只有 `due_at`、無 recurrence 的 todo（例如 backlog 裡的「寫自己的 todo app」帶 `due_at: 2026-05-24`）維持現狀留在 backlog —— `due_at` 語意上是「截止日」，不等於「當天做」，使用者往往會提前幾天做，放 backlog 沒問題。

## 心智模型

「每日例行」這類每天自動產生的 recurring 任務，在 Desk 裡屬於「**其他任務**」這一層:每天自動落到當天、但**不**佔「今天最重要的三件事」的優先序位置。產生之後使用者仍可手動調整（拖進三件事、移到別天、丟回 backlog）。

對應到 Desk 現有的 day bucket:

| Bucket | 條件 | 用途 |
| --- | --- | --- |
| 三件事 | primary + 有 `daily_priority` | 刻意挑選的當天三件事 |
| 其他計劃內 | primary + 無 `daily_priority` + `is_adhoc !== "true"` | recurring occurrence 落這層 |
| 今天臨時加的 | primary + 無 `daily_priority` + `is_adhoc === "true"` | 當天臨時補的 |

recurring occurrence 落「其他計劃內」（不設 `is_adhoc`、不設 `daily_priority`）。

## 機制:BFF 讀取時合成 scheduled_dates

選定在 BFF 的 mapping 層做純讀取衍生，不回寫 WSPC。前端的 `layer()` / `tasksOnDate()` / 拖拉 / trail 邏輯一行都不用改。

### 評估過的替代方案

- **前端 fallback**:把 `recurrence_occurrence_at` 帶進前端 `Task`，讓 `primaryDate()` / `layer()` / `tasksOnDate()` 都多一層 fallback。語意上 `scheduled_dates` 能保持「純使用者軌跡」，但每個讀 `scheduled_dates` 的點都要改，surface area 較大。**未採用。**
- **載入時回寫 WSPC**:看到沒 `scheduled_dates` 的 occurrence 就 PATCH 回去。有 load 時副作用、會對一堆 todo 寫入、有競態。**未採用。**

### 採用方案細節

1. [worker/wspc.ts](../../../worker/wspc.ts) 的 `Todo` interface 補上三個原生欄位（值本來就在 JSON 裡，只是沒型別）:

   ```ts
   export interface Todo {
     // ...existing fields...
     due_at?: string;
     recurrence_occurrence_at?: string;
     recurring_template_id?: string;
   }
   ```

2. [worker/todo-mapper.ts](../../../worker/todo-mapper.ts) 的 `mapTodoToTask`:

   - 當 `recurrence_occurrence_at` 存在 **且** `custom_fields.scheduled_dates` 為空（缺欄或空陣列）→ 合成 `scheduled_dates: [recurrence_occurrence_at]`。
   - **不**合成 `scheduled_months`（避免每日例行灌爆 Month 欄）。
   - 已有 `scheduled_dates` 的（使用者後來移動過）→ 用真實值，不覆蓋。
   - 有 `recurring_template_id` 時，在前端 `Task` 設衍生欄位 `recurring: true`。

3. [src/lib/types.ts](../../../src/lib/types.ts) 的 `Task` 加一個衍生欄位 `recurring?: boolean`（給 ↻ 標記用，**不**放進 `custom_fields` —— `custom_fields` 鏡射 WSPC，`recurring` 是 BFF 衍生）。

### 落到哪一層的推導結果

合成後 occurrence 有 `scheduled_dates = [occurrence date]`、無 `scheduled_months`:

- `primaryDate()` → occurrence date（非 null）→ `layer()` 判 `daily`，離開 backlog。
- 無 `scheduled_months` → 不出現在 Month 欄的 monthly 區，也不在 backlog。

## 顯示（方案 B:同區、加 ↻ 標記）

- **Day 欄「其他計劃內」**:recurring 列尾掛一個 ↻ 圖示。`TaskRow` 依 `task.recurring` 決定是否顯示。
- **Week 欄**:該 occurrence 的 bullet 也顯示 recurring 標記。`WeekTaskItem` 多收一個 `recurring` prop，把原本的「·」bullet 換成 ↻（或在標題旁併排 ↻）。
- **Backlog**:不再出現這些 occurrence（layer 改判 daily 的自然結果，無需額外程式碼）。

評估過的其他顯示方案:**A. 完全合併**（零視覺差異，但看不出哪些是自動產生）、**C. 獨立「例行」小區**（每天多一個區塊、版面較重）。選 **B** —— 不增加版面負擔，又保留「這是每天自動長出來的」訊息，方便後續判斷要不要拖進三件事或丟掉。

## 互動 / 邊界語意

- **移動 / 丟回 backlog**:occurrence 是獨立 todo。使用者拖到別天或丟回 backlog 時，既有的 `planScheduleDay` / trail 邏輯照常運作 —— 前端永遠 PATCH 它看到的完整 `scheduled_dates` 陣列，第一次互動就把合成的日期落實成 WSPC 真值，前端與 WSPC 不會不一致。WSPC 文件亦說明已 materialize 的 instance 各自獨立，改一天不影響其他天。
- **完成**:每個 occurrence 各有自己的 `status`，勾某天的不影響別天（本來就成立）。
- **兩週外**:WSPC 只 materialize 約兩週，更遠的日子沒有 occurrence、那天就不顯示該例行 —— 屬 WSPC 行為，這次不處理。
- **template 本身**:WSPC 的 `listTodos` 不回傳隱藏的 template（已驗證:template id 不在 open 清單），因此不會有 template 漏進 backlog。

## 測試策略

### 自動化測試

- **vitest（[worker/todo-mapper.test.ts](../../../worker/todo-mapper.test.ts)）**:
  - 有 `recurrence_occurrence_at`、無 `scheduled_dates` → 合成 `scheduled_dates: [occurrence date]` 且 `recurring: true`。
  - 已有 `scheduled_dates` → 不覆蓋（保留真實值），仍 `recurring: true`。
  - 只有 `due_at`、非 recurring → 不合成，`scheduled_dates` 維持空、`recurring` 為 falsy（留 backlog）。
- **vitest 元件測試**:`TaskRow` 在 `task.recurring` 為 true 時呈現 ↻;`WeekColumn` 的 recurring bullet 呈現 ↻。
- **單元測試**:`layer()` 對「有 scheduled_dates、無 scheduled_months」的 task 判 `daily`（既有行為，補一個 recurring 命名的案例確保不回歸）。

### e2e（Playwright，對真實 BFF + mock WSPC）

CLAUDE.md 規定改到排程 / Today 互動要跑 `npm run test:e2e`。新增情境:mock WSPC 回一個帶 `recurrence_occurrence_at` 的 occurrence，斷言它:

- 出現在當天的「其他計劃內」、帶 ↻。
- **不**出現在 backlog。

### 手動測試（preview + AI agent）

用測試帳號（dev-login）開 preview，先探測登入狀態、已登入就直接驗收。逐項對照「驗收標準」:

- 那條每日 recurrence rule 的 15 筆「每日例行」occurrence 散到 6/9–6/23 各天的「其他計劃內」。
- Backlog 不再有「每日例行」（件數從 21 降下來）。
- ↻ 標記在 Day 欄與 Week 欄都正確顯示。
- 拖一筆 occurrence 進三件事 / 移到別天 / 丟回 backlog，行為正常、重整後仍正確。

## 驗收標準

1. 帶 `recurrence_occurrence_at` 的 occurrence 自動出現在 `recurrence_occurrence_at` 那天的「其他計劃內」，不佔三件事。
2. 這些 occurrence 不再出現在 backlog。
3. recurring occurrence 在 Day 欄與 Week 欄都帶 ↻ 標記。
4. 一般只有 `due_at`、無 recurrence 的 todo 維持在 backlog，不被自動排入。
5. occurrence 可被拖進三件事、移到別天、丟回 backlog，且重整後狀態正確。
6. `npx vitest run` 與 `npm run test:e2e` 全綠;`npm run build` 型別檢查通過。
