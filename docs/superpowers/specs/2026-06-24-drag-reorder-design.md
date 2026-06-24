# 設計 — 拖曳重排（三件事重排 + 溢出預覽 + 活動池排序）

## 背景與目標

ROADMAP Slice 4 已用 `@dnd-kit/core` 做完**跨欄拖曳**（backlog / 月 / 日 / 週互相搬、排到某天、設名次）。但兩塊一直沒做：

1. **同欄內排序**（Slice 7 item 3，2026-06-24 當時刻意延後，`position` 欄位型別已保留在 `TaskCustomFields` 但完全沒用）。
2. **三件事（①②③）用拖曳重排**，且當重要事項已滿、又拖第 4 件進來時，要在**放下前**就預覽哪一件會被擠出去。

本片把這兩塊一起補完，覆蓋 Plan 三欄（月 / 週 / 日）與 Focus 中欄。這是 v1 拖曳功能的收尾。

## 範圍

### 本片要做

- **三件事拖曳重排**：在三件事區內拖曳改變 ①②③ 順序（日層 `daily_priority`、月層 `monthly_priority`）。
- **滿格溢出 + 放下前預覽**：三件事已滿 3 件時，把第 4 件拖進某名次 → 插入該名次、其餘下推、被推過第 3 名者失去圈號掉回「其他」；拖曳過程中（未放下）即時預覽被擠出的那件移到「其他」第一格。
- **活動池手動排序**：backlog、其他任務（月）、其他計劃內（日）、臨時加的（日）可在桶內拖曳重排，順序寫入 `position`、跨裝置 / 跨 reload 保留。
- **Focus 中欄拖曳**：`TodayLayout` 的中間 Day 欄支援上述三件事重排與其他/臨時加的排序。

### 本片不做

- **衍生區不可手排**：已排入本週（照日期）、其他已完成、已移走（軌跡）維持各自的自動排序規則，不掛拖曳。
- **手機拖曳**：沿用 Slice 4 慣例，排序只在桌機（`hover: hover`）提供；手機不掛，也不加「上移 / 下移」menu。
- **跨欄搬移語意**：Slice 4 既有的跨欄拖曳（backlog → 月 / 日、排到某天、week 日格落點）行為完全不變，本片只在「桶內 / 三件事內」加排序。
- **不改三件事版型**：維持現有獨立特色卡片（accent hero card），不改成扁平清單。

## 資料模型

採**兩軸**結構，不新增「是否重要」這類欄位：

| 面向 | 欄位 | 說明 |
|---|---|---|
| 重要性（成員 + 名次） | `monthly_priority` / `daily_priority`（既有） | 明確 opt-in、`"1"`/`"2"`/`"3"`/空、**分軸**。成員數 0–3，可只設 ①。零 migration。|
| 桶內順序 | `position`（既有保留型別，本片啟用） | lex-order 字串。**只套用在活動池**（backlog / 其他任務 / 其他計劃內 / 臨時加的）；三件事不用 `position`（用 priority 排）。|

### 為何不收成單一欄位

「重要（有名次、上限 3）」與「只是排了序但不重要」是兩種狀態。曾考慮的替代方案都不划算：

- **單一 `position` 排全部、前 3 名自動拿 ①②③**：表達不出「只有一件重要、其他刻意不重要」（會硬把第 2、3 件編號）。
- **`position` 排全部 + `is_important` bool**：重要性是分軸的，`is_important` 得拆成月 / 日兩個 bool，欄位數跟兩個 priority 一樣多；且要拆掉已上線的 priority、重接所有讀取點，是更多工。`daily_priority ∈ {1,2,3,空}` 一個欄位同時表達「是否重要 + 第幾」反而最省。

結論：重要性沿用既有 priority（最 lazy 的重用），只為「活動池排序」這個真正需要的新行為啟用 `position`。

### `position` 細節

- **缺 `position` 的舊任務**：fallback 維持現有穩定順序（store 陣列序）；第一次在該桶拖曳時，惰性為被動到的鄰居補上 `position`。
- **寫入時機**：只在活動池內拖曳重排時寫單筆（midpoint）。三件事重排寫的是 priority、不寫 position。
- **精度**：midpoint 字串理論上會用盡可分割空間；以 `ponytail:` 註記，升級路徑是 rebalance 整桶（重新均分整桶 position）。桶通常只有個位數到數十筆，短期不會觸發。

## 互動模型

每個「day 欄 / month 欄 / week 日格」內，三件事區與其他區是**兩個獨立的 `SortableContext`**，共用一個 `DndContext`（Plan 既有那個；Focus 新增一個只包中欄）。

### 三件事區內重排

- 區內拖曳 → 依放下後的視覺順序重寫 priority `"1"`/`"2"`/`"3"`。
- 只有 1 件時就只有 ①，不會被迫長出 ②③。

### 其他 → 三件事（升級）

- 三件事**未滿 3**：插在放下的名次、其餘下推（例：放第 ② → 原②變③）。
- 三件事**已滿 3**：插入第 4 件 → 該名次起連鎖下推、**被推過第 3 名者失去 priority、落到「其他」桶第一格**（`position` 排在現有第一筆之前）。

### 三件事 → 其他（降級）

- 拿掉該件 priority，剩下的依序重編號（②③ 補位）。
- 落點 `position` 依放下位置算 midpoint。

### 溢出預覽（放下前）

- 拖曳過程中（`onDragOver`），當被拖項目懸停在已滿三件事區的某名次上方時，即時把「會被擠出的那件」視覺移到其他區第一格、並即時重編號 ①②③，讓使用者放下前就看到結果。
- 放下（`onDragEnd`）才落實資料寫入；取消（`onDragCancel`）還原預覽。

### 活動池內重排

- 桶內拖曳 → 算放下位置前後鄰居的 midpoint，寫單筆 `position`、樂觀更新 + 失敗回滾（沿用既有 patch queue）。

## 新增 / 修改

### 新增純函式（`src/lib/` 或 `src/store/taskOps.ts`，皆附單元測試）

- `midpoint(a: string | null, b: string | null): string` — 回傳排在 `a`、`b` 之間的 lex 字串（端點為 null 表示開頭 / 結尾）。`ponytail:` 註記精度用盡 → rebalance 升級路徑。
- `reorderPriority(tasks, id, targetRank, axis, scope)` — 三件事重排 / 跨區升級的單一真實來源：插入名次 + 連鎖下推 + 滿格溢出（溢出者清 priority、`position` 設為桶首之前）。`axis` 為 `"daily"` | `"monthly"`，`scope` 為對應的日期 / 月份。
- `demotePriority(tasks, id, axis, scope, position)` — 三件事 → 其他：清 priority、剩餘重編號、寫落點 `position`。
- `reorderInPool(tasks, id, prevId, nextId)` — 活動池重排：取 `prev` / `next` 的 `position` 算 midpoint，寫單筆。

### 修改

- `src/lib/types.ts`：`position` 已存在，無需改型別。
- `src/store/tasks.ts`：對應 store actions（樂觀更新 + 回滾 + patch queue）。priority 重排可能一次動多筆（下推 / 溢出），全部走既有 queue。
- `src/lib/tasks.ts`：各活動池的 sort 比較子改為「有 `position` 比 `position`，否則維持現有順序」。三件事仍照 priority 取前 3。衍生區比較子不動。
- 列元件（`TaskRow` / `MonthRow` / `BacklogRow` / `Top3Card` 內的列）：`useDraggable` → `useSortable`（保留既有跨欄 droppable 能力）。
- `PlanLayout`：在既有 `DndContext` 內，為各區包 `SortableContext`；加 `onDragOver` 溢出預覽狀態。
- `DayColumn` / `MonthColumn` / `WeekColumn`：三件事區與其他區各包一個 `SortableContext`。
- `TodayLayout`：新增 `DndContext` + 溢出預覽，**只包中間 Day 欄**；左 WeekRail / 右 MonthDigest 不掛 sortable。

### 相依

- 新增 `@dnd-kit/sortable`（`@dnd-kit/core` 姊妹包）。安裝用 `npm install --legacy-peer-deps`（專案既有 peer 衝突慣例）。
- sensor 沿用 `PointerSensor` + activation distance；`hover: hover` gated（桌機限定），不掛 `KeyboardSensor`（沿用 Slice 4 決策；鍵盤排序無對應 menu 為已知限制）。

## 邊界與已知限制

- **手機無排序**：手機（無 hover）只能用 Slice 4 既有的 `⋯` menu 做跨層 promote，無法排序桶內 / 重排三件事。
- **鍵盤無排序**：拖曳是純指標增強；排序動作無鍵盤路徑（跨層 promote 仍可由 menu 鍵盤操作）。
- **多 context 順序共用**：同一個 task 可能同時出現在月欄與日欄的活動池，兩處共用同一個 `position`。視為可接受（同一 task 的相對順序在不同視角一致即可），不為各 view 拆獨立 position。
- **衍生區不可手排**：見「本片不做」。

## 測試策略

### 自動化測試

- **vitest（純函式 + 元件）**：
  - `midpoint`：開頭 / 結尾 / 兩端之間；連續細分仍維持嚴格遞增。
  - `reorderPriority`：①②③ 互換；插入名次下推（放②→原②變③）；**滿格溢出**（插第4件，原③清 priority + `position` 落桶首之前）；只有①時不被迫長②③。
  - `demotePriority`：拿掉圈號、剩餘重編號、寫落點 position。
  - `reorderInPool`：算 midpoint 寫單筆；缺 `position` 任務的 fallback 與惰性補值。
  - 列元件 `useSortable` 化後仍正確渲染與觸發既有動作。
- **e2e（Playwright，必跑 —— 依 CLAUDE.md「改使用者操作流程要跑 e2e」）**：
  - 三件事互換順序。
  - 已滿三件事拖第 4 件進 ② → 原③掉到「其他」第一格。
  - 活動池（其他任務 / backlog）桶內重排，reload 後順序保留。
  - Focus 中欄三件事重排。
  - 手機（窄視窗）不可拖、無排序。
  - dnd-kit 在 Playwright 用 `mouse.move` 分段模擬（非 `dragTo`）。
- **型別**：`npm run build`（= `tsc -b && vite build`，**非** `tsc -p`）。測試檔顯式 `import { describe, it, expect } from "vitest"`。

### 手動測試（preview + AI agent）

由 AI agent 透過 `preview_start` 開預覽，先探登入狀態：已登入直接驗收，未登入才請使用者協助完成 WSPC device flow。逐項對照下方驗收標準，特別驗單元測試抓不到的部分：**溢出即時預覽手感**（放下前被擠出者就移到其他第一格、①②③ 即時重編號）、跨 card 的拖曳 reflow 視覺、活動池重排手感、`position` 跨 reload 保留、Focus 中欄可拖但左右兩欄不可拖、觸控裝置完全不出現拖曳。

## 驗收標準

1. 桌機 Plan / Focus：三件事區內拖曳可改變 ①②③ 順序，放下後 priority 正確重寫。
2. 那天只設 1 件重要時，畫面只有 ①，拖曳不會逼出 ②③。
3. 三件事已滿 3 件，把「其他」一件拖進第 ② 名次 → 插入、原②變③、原③失去圈號並出現在「其他」**第一格**。
4. 上述拖曳**放下前**就即時預覽：被擠出者已視覺移到其他第一格、①②③ 即時重編號；取消拖曳則還原。
5. 三件事拖到其他區 → 失去圈號、剩餘重編號。
6. 活動池（其他任務 / backlog / 其他計劃內 / 臨時加的）桶內可拖曳重排，順序寫入 `position`；reload 後順序保留。
7. 衍生區（已排入本週 / 其他已完成 / 已移走）不可拖曳，維持自動排序。
8. Focus 中欄可做三件事重排與其他 / 臨時加的排序；左 WeekRail、右 MonthDigest 不可拖。
9. 手機（窄視窗）完全不出現拖曳排序；既有 `⋯` menu 的跨層 promote 仍正常。
10. Slice 4 既有的跨欄拖曳（backlog → 月 / 日、排到某天、week 日格落點）行為不變。
11. 拖曳樂觀更新即時反映，失敗回滾並出 toast。
12. `npm run build`、`npx vitest run`、`npm run test:e2e` 全綠。
