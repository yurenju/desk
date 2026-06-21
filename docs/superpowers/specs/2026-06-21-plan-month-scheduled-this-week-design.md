# 規劃頁月欄：標出「已排入本週」+ 摺疊狀態記憶

## 背景與問題

規劃頁（`/plan`）三欄是「月 → 週 → 今天」的漏斗。排週工作時，使用者要在**月欄**判斷：這個月要做的任務，哪些已經排進「本週某一天」、哪些還沒排。

目前月欄「其他任務」用 `tasksOnMonth`（只看 `scheduled_months` 有沒有當月），**完全不看 `scheduled_dates`**。所以一個任務同時排了月（6 月）和日（6/23），會在月欄「其他任務」與週欄 6/23 各出現一次，但月欄這側對「它已經排到 23 號」毫無標示 —— 跟一個完全沒排日的任務長得一模一樣。使用者因此無法在月欄一眼分辨「已排入本週 / 還沒排」。

延伸需求：審視**過去某一週**時，使用者會想看「那週排了哪些任務」（多半已完成）；但看**當週**時，通常不想被已排定的任務干擾，只想處理還沒排的。

對應 wspc 任務：`tod_01KVKSSN1T5WM8PNTN58F573KD`（看不出哪些已排入本週）的延伸。

## 現況

`src/features/month/MonthColumn.tsx`（接 [2026-06-21 月份欄改版](2026-06-21-month-list-redesign-design.md) 之後）目前把 top3 以外的列分三組：

- **其他任務**（展開）：`kind === "primary"` 且未完成。
- **▸ 已完成 (N)**（收合）：所有 `status === "done"`。
- **▸ 已移走 (N)**（收合）：未完成的 forwarded / dismissed。

摺疊用 `CollapseGroup`（`MonthColumn` 內的小元件），`useState(false)` 預設收合，**狀態不持久**：重整、切月、切週都重置。

週的範圍由 `weekOf(selectedDate)`（`src/lib/date.ts`）算出 7 個 ISO 日期；`MonthColumn` 已收到 `selectedDate`，所以「本週」資料齊全，且切週會跟著變。

衍生函式 `primaryDate(t)`（`src/lib/tasks.ts`）= `scheduled_dates` 最後一個元素，且須大於 `unscheduled_at`，否則為 null。

## 設計

純前端、全部從現有 `custom_fields` 衍生，**不改 wspc schema、不改任何寫入**。兩塊：分組多一個「本週」維度；摺疊狀態用 localStorage 記住。

### 第一塊：月欄分組加入「已排入本週」

top3（本月三件事）維持現狀。top3 以外的列，依**優先序由上而下、命中即停**歸入四組，保證一筆只進一組：

1. **已排入本週**：`primaryDate(t)` 落在 `weekOf(selectedDate)` 內（**含已完成**，打勾刪節線）。
2. **其他已完成**：`status === "done"` 且不在本週。
3. **已移走**：未完成的 forwarded / dismissed（`kind !== "primary"`）且不在本週。
4. **其他任務**：其餘（未完成、primary、不在本週）。

欄內呈現順序（由上而下）：

- top3 hero card（不變）。
- **其他任務**（永遠展開）：排週工作時真正要動手的待辦池 —— 還沒排到本週的未完成任務。沿用現有 `is_adhoc` 沉底排序與拖延點。其中若某列**已排到別週某天**（`primaryDate(t)` 非 null 但不在本週），右側加一個極淡的短日期提示（`M/D`，例：`6/30`），避免重複排程。
- **▸ 已排入本週 (N)**（收合、狀態記憶）：本週各天已排的任務，含已完成。每列右側顯示週幾 chip（`週一`…`週日`）；已完成者刪節線並標「已完成」。這組內容隨切週改變，過去週展開它就是那週的回顧。
- **▸ 其他已完成 (N)**（收合、狀態記憶）：完成、但沒排進本週的任務（例如月層級直接做掉的）。
- **▸ 已移走 (N)**（收合、狀態記憶）：不變。

為什麼「已排入本週」要含已完成、且優先於「其他已完成」：審視過去週時，使用者想看的是「那週排了什麼」，而那些多半已完成；若已完成一律歸「其他已完成」，過去週回顧會缺一半。優先序讓「排在本週的已完成任務」只出現在「已排入本週」，不重複。

### 第二塊：摺疊狀態用 localStorage 記住（全域）

三個摺疊群組（已排入本週 / 其他已完成 / 已移走）的展開狀態各自存進 localStorage，**全域一份、跨週跨月共用**：

- 第一次（沒有存值）用預設 —— 三組皆收合。
- 之後一律沿用使用者上次手動的開關，**不依當週 / 過去週自動變動**（邏輯最單純；要回顧過去週就自己展開，看完收起）。
- 重整後保留。

key 命名沿用 `desk.*` 慣例（見 `src/lib/theme.ts`）：

```ts
// collapsed = true（預設）；展開時存 false
"desk.plan.month.collapse.scheduledThisWeek"
"desk.plan.month.collapse.doneOther"
"desk.plan.month.collapse.movedAway"
```

`CollapseGroup` 從 `useState(false)` 改成接一個 `persistKey`，初值讀 localStorage（無值則預設收合），toggle 時寫回。比照 `theme.ts` 做 `typeof localStorage === "undefined"` 防呆。

### 衍生函式（放 `src/lib/tasks.ts`）

```ts
// The task's effective day if it falls within `week` (the 7 ISO dates of weekOf), else null.
export function dayInWeek(t: Task, week: string[]): string | null {
  const d = primaryDate(t);
  return d && week.includes(d) ? d : null;
}
```

「其他任務」列的別週提示直接用 `primaryDate(t)`（非 null 且不在本週時）。週幾 chip 需要一個中文星期格式器 `weekdayZh(date)` → `週日`…`週六`（放 `src/lib/date.ts`，比照現有 `shortWeekday`）。

## 元件邊界

| 單元 | 職責 | 依賴 |
| --- | --- | --- |
| `dayInWeek(task, week)`（`tasks.ts`） | 算任務的有效日是否落在本週、是則回傳該日 | `primaryDate`、`weekOf` 的結果 |
| `weekdayZh(date)`（`date.ts`） | ISO 日期 → 中文星期 | 無 |
| `MonthColumn` | 用 `weekOf(selectedDate)` 把 top3 以外的列分四組（優先序）、組裝欄位 | `tasksOnMonth`、`dayInWeek` |
| `MonthRow` | 已排入本週列顯示週幾 chip；其他任務列的別週短日期提示 | `weekdayZh`、`primaryDate` |
| `CollapseGroup`（`MonthColumn` 內） | 收合/展開 + localStorage 記憶展開狀態 | `persistKey` |

## 刻意不做（YAGNI）

- **persist 不依週 / 月分別記**：全域一份。要逐週獨立記等實際嫌煩再升級。
- **不改週欄 / 今天欄 / backlog**：本週回顧的每日明細，週欄本來就有。
- **不重排**「其他任務」段（沿用既有排序），只是把「已排入本週」抽出去。
- 不動 wspc schema 與任何寫入；別週提示不做相對詞（「下週三」），只顯示 `M/D`，跨距遠也不會錯。

## 測試策略

- **單元測試（vitest）**：
  - `tasks.test.ts`：`dayInWeek` —— 有效日在本週回傳該日、不在回 null、`primaryDate` 為 null 回 null、被 `unscheduled_at` 蓋掉的不算。
  - `date.test.ts`：`weekdayZh` 七天對應正確。
  - `MonthColumn.test.tsx`：四組優先序（已完成且在本週 → 進「已排入本週」不進「其他已完成」；未完成在本週 → 進「已排入本週」；完成不在本週 → 「其他已完成」；別週的未完成 → 「其他任務」並帶短日期提示）；切換 `selectedDate` 到別週時分組跟著變。
  - `CollapseGroup`（在 `MonthColumn.test.tsx` 或獨立）：預設收合、展開後寫入 localStorage、重新掛載讀回上次狀態。
  - `MonthRow.test.tsx`：已排入本週列有週幾 chip；其他任務列在排到別週時顯示 `M/D`、沒排日時不顯示。
- **e2e（Playwright，`npm run test:e2e`）**：本案改月欄分組與摺疊互動，需更新／新增 `e2e/*.spec.ts` 涵蓋「已排入本週群組存在且含已完成項」「展開狀態重整後保留」，並在本機跑過（先停掉 preview dev server 再跑，避免 port 衝突）。
- **手動測試（preview + AI agent）**：AI agent 先用共用 profile 開 preview 探登入狀態（已登入直接驗收，未登入才請使用者協助 device flow）。逐項對照下方驗收標準，重點看：切到不同週時「已排入本週」內容跟著換；展開「已排入本週」後切月再切回、重整，展開狀態都還在；已排到別週的任務在「其他任務」裡帶淡淡的 `M/D`。

## 驗收標準

1. 月欄「其他任務」只剩「未完成、且沒排到本週」的任務（待辦池），不被已排定的稀釋。
2. 排到本週某天的任務（含已完成）集中在「▸ 已排入本週 (N)」摺疊群組，每列有週幾標示；已完成者刪節線。
3. 切換週數時，「已排入本週」的內容隨之改變（看當週、可回顧過去週）。
4. 排到本週的已完成任務只出現在「已排入本週」，不重複出現在「其他已完成」。
5. 三個摺疊群組的展開／收合狀態存於 localStorage：預設收合、手動開關後重整仍保留、切週切月不自動變動。
6. 已排到「別週」某天的未完成任務留在「其他任務」，右側有極淡的 `M/D` 提示。
7. 純前端衍生，未變更任何 wspc 寫入或 schema。
8. `npm run build`、`npx vitest run`、`npm run test:e2e` 皆通過。
