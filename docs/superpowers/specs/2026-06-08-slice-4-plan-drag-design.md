# Slice 4 設計 — Plan 模式完整拖曳 + Backlog 互動

## 背景與目標

ROADMAP Slice 4 原本只是「Backlog 互動 + 三層漏斗完整」，且把真實拖曳延到 Slice 7。本片在 brainstorming 後**擴大範圍**：一次把 **Plan 模式的完整拖曳重排**做完（不只 backlog，月 / 日 / 週上的 task 都可拖），並補上 backlog 的寫入互動。

核心目標：**在 Plan 模式裡，使用者可以用拖曳把任務在 Backlog / 月 / 週各天之間自由安排**，手感像每週規劃儀式；同時 backlog 從唯讀變可寫（新增 / 完成 / 編輯 / 刪除 / promote）。

Focus 模式的「順延 / 略過 / 丟回月」是另一套語意，**不在本片**，留給 Slice 5 / 6。

## 設計依據：Plan 與 Focus 的語意分流

這片最關鍵的決定，是把「拖到別天」依模式分成兩種完全不同的語意：

| | **Plan（規劃）** | **Focus（專注）** |
|---|---|---|
| 心態 | 決定「這件事哪天做」 | 回顧「昨天沒做完的」 |
| 拖到別天 | 改主意 → **乾淨重排**，不留軌跡 | 沒做完 → **順延** → append + 留軌跡 |
| 歸屬 | 本片（Slice 4） | Slice 5 / 6（carryover / dismiss）|

理由：規劃時把任務從週一挪到週三，是「重新決定哪天做」，不該被記成一次拖延；但 Focus 模式看昨天未完成的任務、決定順延到今天或丟回月，才是真正的拖延軌跡。

## 範圍

### 本片要做

- Backlog 寫入互動：新增、完成、編輯、刪除。
- Plan 模式拖曳（桌機）：Backlog / 月 / 日 / 週的 task 皆可拖，放到 Month 區 / Day 欄 / Week 各日格。
- Plan 模式 promote 的 `⋯` menu（手機 + 桌機 fallback）。
- 新的乾淨重排 op `planScheduleDay`（替換 vs append）。
- 加入點 `is_adhoc` 預設值。

### 本片不做

- Focus 模式的拖曳與順延語意（Slice 5 / 6）。
- 日 → 月「降級 / 丟回月」（Slice 6）。理由：task 排到某天時已**補本月**，本來就還顯示在 Month 欄，不需要額外的降級動作。
- 同欄拖曳排序（`position` 欄位，Slice 7）。
- 手機的 day↔day 重排（見「已知限制」）。

## 模式與裝置分流

- **拖曳只在 Plan 模式**：`DndContext` 只掛在 `PlanLayout`；`TodayLayout`（Focus）完全不動。
- **裝置分流**（沿用既有 `@media (hover: hover)` 慣例，見 `src/features/day/TaskRow.tsx` 行尾動作的偵測）：
  - 桌機（`hover: hover`、欄位並排）：拖曳 + `⋯` menu 都有。
  - 手機（觸控、Plan 為 tab 切換）：只有 `⋯` menu。
- backlog 本來就只出現在 Plan 的 Month 欄（`MonthColumn` 內，Focus 用的是 `MonthDigest`），所以 backlog 拖曳天生就是 Plan 限定。

## Plan 拖曳核心語意：`planScheduleDay`

新增 op `planScheduleDay(tasks, id, date)`，是 Plan 模式所有「排到某天」路徑（拖曳 + menu）的單一真實來源：

- 若 task **已有 `primaryDate`**（已排在某天）→ **替換 `scheduled_dates` 最後一筆**為 `date`（重排）。
- 若 task **沒有 `primaryDate`**（在 backlog 或只在月層）→ **append `date`**（第一次排日）。
- 兩種情況都確保 `monthOf(date)` 在 `scheduled_months` 內（**補本月**；不在才 append）。

### 為何「替換最後一筆」不違反 append-only 不變式

資料模型規定 `scheduled_dates` append-only、`陣列長度 = 跨日拖延次數`，且軌跡顯示靠「非 last 的 entry」。`planScheduleDay` 的替換**只動最後一筆（當前 primary）、從不碰已成軌跡的較早 entry**：

```
原: [2026-06-01(軌跡), 2026-06-08(primary)]   ← 上週順延到本週一
Plan 重排本週一 → 本週三:
新: [2026-06-01(軌跡), 2026-06-10(primary)]
```

`2026-06-01` 這筆真實順延軌跡保留、陣列長度不變、未新增一筆假順延。被替換掉的 `2026-06-08` 是「尚未發生的當前安排」、不是歷史軌跡，替換它不抹除任何已成立的拖延紀錄。

### `nextFreeDailySlot`

純函式 `nextFreeDailySlot(tasks, date): Priority`：掃該日 `primaryDate === date` 的 task，回傳 `daily_priority` 1 → 2 → 3 第一個空位；三格全滿回傳 `"3"`（交給 `setDailyPriority` 既有擲位邏輯把原 ③ 擠成無名次）。

## 拖曳來源與放下區（Plan、桌機）

**拖曳來源**：`BacklogRow`、`MonthRow` / `MonthHeroCard` 的列、Day 欄 task 列、Week 各日格內的 task。

**放下區**：Month 區、Day 欄（分子區）、Week 每個日格（分子區）。

### 統一的「日目標」規則

Day 欄與**每個** Week 日格都暴露兩個 droppable 子區，落點決定要不要設名次：

- drop 在某日的**三件事區** → `planScheduleDay(id, 該日)` + `setDailyPriority(id, nextFreeDailySlot(該日), 該日)`
- drop 在某日的**其他區** → `planScheduleDay(id, 該日)` 並清掉 `daily_priority`

Week 日格視覺上本來就有「三件事（top-3 標題）」與「其他（『還有 n 件其他任務』計數）」兩塊，子區對應這兩塊。日格即使該區為空，仍需是可放下的目標（給最小高度）。

### 各來源 × 放下區行為

| 放下區 | backlog 來源 | 月來源（無 primaryDate）| 日來源（有 primaryDate）|
|---|---|---|---|
| **Month 區** | `promoteToMonth(本月)` → 其他計劃內 | no-op（已在本月）| 忽略（降級不做，見「不做」）|
| **某日 · 三件事區** | `planScheduleDay` + 設名次 | 同左 | 重排到該日 + 設名次 |
| **某日 · 其他區** | `planScheduleDay`（清名次）| 同左 | 重排到該日（清名次）|

「某日」涵蓋 Day 欄的焦點日，以及 Week 各日格各自的日期。

## menu 動作（手機 + 桌機 fallback）

- **`BacklogRow` 的 `⋯`**：
  - `→ 本月（其他計劃內）` = `promoteToMonth(本月)`
  - `→ 焦點日 · ① / ② / ③ 三件事` = `planScheduleDay(焦點日)` + `setDailyPriority(n, 焦點日)`
  - `→ 焦點日 · 其他` = `planScheduleDay(焦點日)`（清名次）
  - `編輯`、`刪除`
- **`MonthRow` 的 `⋯`**：沿用既有 `→ N日 · ①②③ / 其他`，底層改用 `planScheduleDay`（對月來源等於 append、無回歸）。
- **Day `TaskRow` 的 `⋯`**：不變（計畫內外切換 / 編輯 / 刪除）。day↔day 重排走拖曳，menu 不加。

## 元件與 op 清單

### 新增

- `src/features/backlog/BacklogRow.tsx` + `useBacklogRow.ts`：取代現在 `BacklogSection` 誤用 day `TaskRow` + 假 `today` 的做法。結構仿 `MonthRow`：checkbox（完成）、title（雙擊 inline 編輯）、`⋯` menu、桌機可拖曳。**無 priority ring**（backlog 無有效優先序）。
- `src/features/backlog/AddBacklogTaskInput.tsx`：仿 `AddMonthTaskInput`，放在 `BacklogSection` 展開區底部。
- `src/store/taskOps.ts`：`addBacklogTask`、`promoteToMonth`、`planScheduleDay`、`nextFreeDailySlot`。
- `src/store/tasks.ts`：對應 store action（樂觀更新 + 失敗回滾，沿用既有 patch queue）。

### 修改

- `src/features/backlog/BacklogSection.tsx`：用 `BacklogRow` 取代 `TaskRow`、加 `AddBacklogTaskInput`。
- `src/features/plan-view/PlanLayout.tsx`：掛 `DndContext` + `DragOverlay`（title ghost）；只在 `hover: hover` 啟用 sensor。
- `MonthColumn` / `MonthRow` / `MonthHeroCard`、`WeekColumn`（日格）、`DayColumn`：列包 `useDraggable`、區塊包 `useDroppable`（皆 Plan + `hover: hover` gated）；`isOver` 時 drop 高亮。
- `MonthRow` promote：改用 `planScheduleDay`。

### 相依

- 新增 `@dnd-kit/core`。安裝用 `npm install --legacy-peer-deps`（專案既有 peer 衝突慣例）。
- 桌機掛 `PointerSensor`（含 activation distance 避免誤觸）。拖曳為純指標操作；**不掛 `KeyboardSensor`**（dnd-kit KeyboardSensor 在自由形式 drop zone 需要客製 `coordinateGetter`，沒有就會讓列獲得 focus 但操作無效，體驗更差）。手機那條路不掛 DnD。

## 資料層細節

### `is_adhoc` 預設值（依 ROADMAP「加入點預設值」表）

| 加入點 | `scheduled_months` | `scheduled_dates` | `is_adhoc` |
|---|---|---|---|
| Backlog + | `[]` | `[]` | `"false"` |
| Backlog → 月 | append 本月 | （維持）| 不變 |
| Backlog / 月 → 某天 | （補本月）| append / 替換該日 | 不變 |

所有 promote **不更動 `is_adhoc`**；只有 `addBacklogTask` 寫死 `"false"`。

### store PATCH

- `planScheduleDay` 的 store action 要同時 PATCH `scheduled_dates` **和** `scheduled_months`（補本月時），現有 `promoteToDay` 只送 `scheduled_dates`。
- `addBacklogTask` 走 `postTodo`，body 不帶 `scheduled_*`（空陣列），`is_adhoc: "false"`。

## 邊界與已知限制

- **day↔day 重排是桌機拖曳手勢，手機無對等 menu**：手機 menu 只能 backlog / 月 → 焦點日。手機使用者要重排某天的任務到別天，本片不支援（可用桌機）。
- **日 → 月降級不做**：task 排到某天已補本月、仍顯示在 Month 欄，無需「丟回月」；真正的丟回月留 Slice 6。
- Month 區放下只對 backlog 來源有意義；月 / 日來源放這裡為 no-op 或忽略。

## 測試策略

### 自動化測試

- **vitest**：
  - `addBacklogTask`（空 `scheduled_*`、`is_adhoc:"false"`）
  - `promoteToMonth`（append 本月）
  - `planScheduleDay`：無 primaryDate → append；有 primaryDate → 替換最後一筆；補本月；**保留較早軌跡 entry**
  - `nextFreeDailySlot`（首空位 / 全滿回 `"3"`）
  - `BacklogRow`、`AddBacklogTaskInput` 元件行為
- **e2e（Playwright，必跑）**：依 CLAUDE.md「改使用者操作流程要跑 e2e」。
  - backlog → 月 menu
  - backlog → 焦點日 · 名次 menu
  - 桌機拖曳：backlog → 月 / 日（三件事 vs 其他子區）/ Week 日格；day → day 重排（驗替換不留軌跡）
  - dnd-kit 在 Playwright 用 `mouse.move` 分段模擬（非 `dragTo`）
- **型別**：`npm run build`（= `tsc -b && vite build`，**非** `tsc -p`）。測試檔顯式 `import { describe, it, expect } from "vitest"`。

### 手動測試（preview + AI agent）

由 AI agent 透過 `preview_start` 開預覽，先探登入狀態：已登入直接開始驗收，未登入才請使用者協助完成 WSPC device flow。逐項對照下方驗收標準，特別驗單元測試抓不到的部分：拖曳手感、drop 高亮、替換重排不留軌跡的視覺、觸控裝置只出 menu 不可拖、Week 日格子區落點正確。

## 驗收標準

1. Backlog 展開區底部有輸入框，新增任務寫入空 `scheduled_*`、`is_adhoc:"false"`，出現在 backlog 列表。
2. Backlog 列可完成（勾選寫 `done_on`）、雙擊編輯 title、刪除（soft-delete + undo）。
3. 桌機：把 backlog 列拖到 Month 區 → 任務離開 backlog、出現在該月「其他計劃內」。
4. 桌機：把 backlog 列拖到 Day 欄「三件事」區 → 排到焦點日且取得首個空名次；拖到「其他」區 → 排到焦點日、無名次。
5. 桌機：把 backlog 列拖到 Week 某日格的三件事 / 其他區 → 排到**該日**（非焦點日）、名次依子區。
6. 桌機：把已排在某天的 task 拖到別天 → **乾淨重排**，舊那天不出現順延軌跡；若該 task 有更早的真實順延軌跡，軌跡保留。
7. 拖到某日時 `monthOf(該日)` 自動補進 `scheduled_months`，該 task 同時顯示在 Month 欄。
8. 拖曳中目標放下區有高亮；放開後樂觀更新立即反映，失敗回滾並出 toast。
9. 手機（窄視窗）：backlog / 月列只出 `⋯` menu、無法拖曳；menu 的 `→ 本月` / `→ 焦點日 · 名次` 正常運作。
10. 鍵盤無障礙透過 `⋯` menu 提供：focus 到列、開 menu、選 promote 動作，全程純鍵盤可操作。拖曳是純指標增強，無鍵盤拖曳。
11. `npm run build`、`npx vitest run`、`npm run test:e2e` 全綠。
