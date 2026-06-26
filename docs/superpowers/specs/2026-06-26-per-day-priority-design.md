# 每天 / 每月獨立順位（per-period priority）設計

## 背景與問題

目前任務的「今日重點」順位存在單一欄位 `daily_priority`（`"1"|"2"|"3"`），「本月三件大事」順位存在 `monthly_priority`。這兩個都是**綁在 task 上的單一值**，不是綁在「task + 那一天 / 那一月」。

因為一個任務的 `primaryDate` 只有一天（`scheduled_dates` 最後一個未被 `unscheduled_at` 蓋掉的日期），同一時間它只 primary 在一天，所以「畫面上每天的前三名」大致已是各自獨立。真正的缺口在**同一任務跨天 / 跨月搬動**時：順位會跟著任務走、殘留到新的一天。

具體症狀：

- 把昨天排第 1 的任務移到今天，再在今天重排順位，會改到同一個 `daily_priority` 欄位，連帶影響昨天那列的顯示——昨天記不住它當時是第幾。
- 上一個改動（就地 trail）為了讓「丟回月度」的列留在 Top3 原位，被迫保留單值 `daily_priority`；這個權宜做法的副作用是：日後若把它重新排到別天，會帶著舊的重點編號。

目標是讓順位成為「(task, 期間)」的屬性：**每一天、每一個月各自記得自己的順位**，互不影響。

## 目標

- 日順位改成 per-date：同一任務在不同日各自的順位獨立保存。
- 月順位改成 per-month：同一任務在不同月各自的順位獨立保存。
- 歷史保留：搬動後，來源日 / 來源月的 trail 列顯示**當時那一天 / 那一月**的順位。
- 零停機遷移：既有任務不需批次轉換即可繼續正確顯示。

## 非目標

- 不改「其他計劃內 / 待辦」的 `position` pool 排序（它同樣是 task 單值、跨期間共用，但不在本次範圍）。
- 不改 `primaryDate` / `primaryMonth` / `layer()` 的語意——它們仍決定任務「現在屬於哪天 / 哪月」，與順位正交。
- 不改每期間最多 3 個重點的上限規則本身（只是把判定範圍縮到 per-period）。

## 資料模型

### 新增兩個 custom field（string_array）

WSPC custom field 型別只有 `string` 與 `string_array`，且不可變更既有 key 的型別，故**新增**而非改型別：

- `daily_ranks`：每筆編碼 `"YYYY-MM-DD:R"`，`R ∈ {1,2,3}`。例：`["2026-06-25:1", "2026-06-26:3"]`。
- `monthly_ranks`：每筆編碼 `"YYYY-MM:R"`。例：`["2026-06:1", "2026-07:2"]`。

選用 string_array 而非「單一 JSON string」的理由：符合 `scheduled_dates` 既有慣例、可對單一期間獨立增刪、肉眼可讀、方便 partial 更新。

### 舊欄位作為 fallback（lazy 遷移）

- `daily_priority` / `monthly_priority`（string 單值）**保留在 schema**，前端停止寫入，只當讀取 fallback。
- 既有任務不做批次轉換：它的舊單值在它「當前 primaryDate / primaryMonth」那一個期間仍生效；一旦使用者在任一期間重設順位，就寫進新的 `*_ranks`，自然汰換。

## 讀寫行為

### 編解碼 / 查詢 helper（集中一處）

新增一組純函式（檔案位置實作時定，傾向新檔 `src/lib/ranks.ts`），至少包含：

```ts
type RankMap = Map<string, Priority>;          // key = date or month
function parseRanks(arr: string[] | undefined): RankMap;
function encodeRanks(map: RankMap): string[];   // 穩定排序輸出
function setRank(arr: string[] | undefined, key: string, rank: Priority | null): string[];
```

以及綁定語意的查詢（放 `lib/tasks.ts`）：

```ts
// 先查 *_ranks 的該期間；查不到、且該期間正好是 primaryDate/primaryMonth、又有舊單值 → 回舊值。
function dailyRankOn(task: Task, date: string): Priority | null;
function monthlyRankOn(task: Task, month: string): Priority | null;
```

### 篩選與顯示

- 各 day 的 Top3 = 該日 entries 中 `dailyRankOn(task, date)` 有值者，依 rank 排序。
- 各 month 的 Top3 同理用 `monthlyRankOn(task, month)`。
- trail 列的順位圈用 `dailyRankOn(task, trailDate)`，顯示它在那一天的歷史順位。

### 寫入（`taskOps`）改為 per-period

- `setDailyPriority(id, rank|null, date)`：更新 `daily_ranks` 中該 `date` 的條目；撞號驅逐只在**同一天**生效。`setMonthlyPriority` 同理對 month。
- `reorderPriority(axis, scope)`：在指定 scope（date 或 month）內重排，只動該 scope 的 ranks。
- `nextFreeDailySlot`：改成查指定那天的 `daily_ranks`。
- `moveToToday`：在「今天」這個 date 寫一筆 rank（today 內取 free slot；滿則不設、落「其他計劃內」）。**來源日的 rank 條目保留不動**。
- `demoteToMonth`：dismiss 那天（`unscheduled_at`），但 `daily_ranks` 該日條目**保留**（取代上一版「硬留住單值 `daily_priority`」的權宜做法）。
- `promoteToMonth` / `planScheduleDay` / `moveToNextMonth` / `demoteToBacklog`：換到新 scope 時，新 scope 沒有 rank（除非另設），舊 scope 的 rank 保留為歷史。

### 同步到後端（`store/tasks.ts` + worker）

- `enqueuePatch` 改送整個 `daily_ranks` / `monthly_ranks` 陣列（string_array 整包覆寫）。
- `worker/routes/todo.ts` 的 PATCH handler 加這兩欄位轉發；`mapTodoToTask` 靠既有 custom_fields passthrough 自動支援讀取，免改。

## 影響範圍

**後端 / BFF**

- WSPC DeskTask type 新增 `daily_ranks`、`monthly_ranks`（string_array），一次性 `todo_type_update`（additive，不動既有 9 欄）。
- `worker/routes/todo.ts` PATCH body 與 customFields 轉發加兩欄位。
- `worker/wspc-types.ts`、`src/lib/api/todo.ts` 的型別補欄位。

**核心邏輯**

- `src/lib/types.ts`：`TaskCustomFields` 加 `daily_ranks?: string[]`、`monthly_ranks?: string[]`。
- 新 rank helper（`src/lib/ranks.ts`）＋ `lib/tasks.ts` 的 `dailyRankOn` / `monthlyRankOn`。
- `src/store/taskOps.ts`：上述所有順位相關 op 改 per-period。
- `src/store/tasks.ts`：對應 action 的 `enqueuePatch` 欄位。

**UI 讀取點（約 20 檔，全部改走 helper）**

- day：`DayColumn` / `Top3Card` / `TaskRow` / `useTaskRow` / `taskRowMenu` / `DailyPriorityMenu`
- week：`WeekColumn` / `WeekRail`
- month：`MonthColumn` / `MonthRow` / `MonthHeroCard` / `MonthDigest` / `useMonthRow` / `monthRowMenu`
- plan：`planDrag`（`buildDayContainers` / `buildMonthContainers` / `buildWeekContainers` / `planCommit`）/ `PlanLayout`
- task-detail：`TaskDetailModal`

**資料 / 測試**

- `src/mock/data.ts`、`e2e/fixtures/wspc-fake.ts` seed 補新欄位。
- 對應 vitest 與 e2e 更新。

## 風險與取捨

- **讀取點多（~20 檔）**：遺漏會造成順位顯示不一致。對策：查詢邏輯集中在 helper，靠 `grep` 對 `daily_priority` / `monthly_priority` 全覆蓋，逐一改為 helper。
- **string_array 清空語意**：「移除某期間的 rank 後該欄位變空」要送 `[]`，與既有 `scheduled_dates` 的處理一致；確認 worker patch 對空陣列的行為。
- **WSPC schema 變更動到正式資料**：additive、安全，但實作該步驟前先跟使用者確認再執行 `todo_type_update`。
- **舊單值 fallback 的邊界**：fallback 只在「該期間 === 當前 primaryDate/primaryMonth 且新陣列無此期間」時生效，避免舊值在非當前期間誤現。helper 需有測試涵蓋此邏輯。

## 測試策略

- **單元測試（vitest）**：
  - rank helper：`parseRanks` / `encodeRanks` / `setRank` 的編解碼與邊界（空、重複 key、非法格式略過）。
  - `dailyRankOn` / `monthlyRankOn`：新欄位優先、fallback 舊單值、非當前期間不 fallback。
  - `taskOps`：per-period 設定 / 驅逐 / free slot；`moveToToday` 來源日 rank 保留、今天取得新 slot；`demoteToMonth` 保留該日 rank。
- **元件測試（Testing Library）**：DayColumn / Top3Card / WeekColumn / MonthColumn 依 per-period rank 正確分區與顯示順位圈。
- **e2e（Playwright，對真實 BFF + mock WSPC）**：跨天搬動後，來源日與目標日各自顯示獨立順位；丟回月度後來源日 trail 顯示當時順位。改到 Today / Plan 互動，需連同 `e2e/*.spec.ts` 更新並在本機跑過。
- **手動測試（preview + AI agent）**：由 AI agent 透過 `preview_start`（或 playwright-cli 共用 profile）開預覽，先探測登入狀態，已登入就直接驗收。實際操作：在某天設三個重點 → 移一個到今天 → 確認來源日仍記得它原本的順位、今天是新的順位；對月度做對應操作。逐項對照下方驗收標準。

## 驗收標準

1. 在 A 日把任務設為第 1，移到 B 日並在 B 日設為第 3：A 日顯示該任務第 1（trail），B 日顯示第 3，互不影響。
2. 把 A 日的 Top3 任務「丟回月度」：該列留在 A 日的 Top3 卡片、灰、顯示當時順位與「↩ 已退回本月」。
3. 月度：任務在 6 月設為第 1，延到 7 月設為第 2：兩個月各自記得自己的順位。
4. 既有任務（只有舊 `daily_priority` / `monthly_priority`）未經任何操作時，在其當前期間仍正確顯示原順位（fallback 生效）。
5. `npm run build` 型別通過；`npx vitest run` 全綠；`npm run test:e2e` 全綠。

## 建議切片（writing-plans 再細化）

1. rank 編解碼 / 查詢 helper（純函式、TDD）。
2. `types` + worker PATCH 欄位轉發 + `api/todo` 型別。
3. `taskOps` 全面改 per-period + 測試。
4. `store` / `api` 的 enqueue 欄位。
5. UI 讀取點：day → week → month → plan / detail。
6. WSPC schema 變更 + mock / e2e seed + 手動驗收（產生驗收報告）。
