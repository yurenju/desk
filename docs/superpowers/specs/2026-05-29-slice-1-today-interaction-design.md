# Slice 1 — Today 互動 + localStorage 設計文件

> 對應 ROADMAP「Slice 1 — Today 互動 + localStorage」。本片是純前端片,不接 WSPC / auth。

## 目標與範圍

讓 **Today mode** 的 task 真正可互動,所有寫入進 Zustand store 並持久化到 localStorage,刷新後資料還在。目的是在沒有後端噪音的情況下確認「最小可用單元」的 UX 與資料寫入手感。

**範圍內**:

- Today mode 的完成 / 取消、新增、inline 編輯、刪除、`daily_priority` 切換
- Zustand store + localStorage persist
- Plan mode 改讀同一個 store(**仍唯讀**)

**範圍外**:WSPC、auth、拖曳、Backlog 寫入、軌跡(forwarded / dismissed)寫入、carryover 動作、月底 review。

## 狀態管理架構

- 新增依賴 `zustand`,建立 `useTasksStore`(`src/store/tasks.ts`)。
- 使用 `persist` middleware,key 為 `desk.tasks`。
- **Seed 策略**:store 的 initial `tasks` 直接設為 `allTasks`;`persist` 若 localStorage 有存檔就覆蓋初始值,沒有就用 seed。等效於「只有首次(無存檔)才 seed」,且使用者把 task 全刪光後不會重新長出來。
- store 持有 **`today`** 欄位(初值 = `MOCK_TODAY`)。所有 component 一律從 store 讀 `today`,**不再各自 import `MOCK_TODAY`**。Slice 2 要換成真實 / 可切換日期時只動這一處。
- **資料流**:各 component 以 selector 直讀 store(`useTasksStore(s => ...)`),actions 也從 store 取。`TodayPage` / `PlanPage` 不再 props drilling。

排除過的替代方案:

- `Context + useReducer`:樣板多、重渲染顆粒度粗。
- 維持 page props 注入:`TaskRow` / `Top3Card` 等的 props 會明顯爆增。

## Store actions(行為語意)

| action | 語意 |
|---|---|
| `toggleDone(id)` | `open` ⇄ `done`;切到 done 時寫 `done_on`(ISO),取消時清掉 `done_on` |
| `addTodayTask(title)` | 建立 task:`scheduled_dates = [today]`、`is_adhoc = "true"`、`status = "open"` |
| `editTitle(id, title)` | 改標題;`title` 去空白後為空則視為取消,不寫入空標題 |
| `deleteTask(id)` | 從 store 移除,暫存到 `recentlyDeleted`(含原本 index)供 undo |
| `restoreTask()` | 把 `recentlyDeleted` 放回原本位置 |
| `setDailyPriority(id, n)` | **自動騰位**:若別的 task 已佔序號 `n`,先清掉它的 `daily_priority`(退回「其他計劃內」),再把 `n` 指派給 `id`;`n` 為 `null` 表示移除自己的序號。序號池僅 `1/2/3`,因此永遠不重複 |

## 互動規格(Today mode)

### 完成 / 取消

勾 checkbox → `toggleDone`。沿用 Slice 0 的手繪 ✓ 動畫,完成後 task **留原位**,淡成灰色加刪除線(位置不跳動)。

### 新增

日欄最下方一條**常駐輸入列**(`AddTaskInput`)。打字後按 Enter → `addTodayTask`,新 task 進「今天臨時加的」區、帶紅「臨時」chip。今天沒有任何 task 時顯示鼓勵文案 + 同一條輸入列(空狀態)。

### inline 編輯

hover row 時行尾浮現 **✎**。點 ✎ 後 title 就地變 input:Enter 儲存(`editTitle`)、Esc 取消、內容空白視為取消。

### 刪除

hover row 時行尾浮現 **🗑**。點了直接刪除,並在畫面底部顯示「已刪除 · 復原」短暫 toast(`DeleteUndoToast`),點復原 → `restoreTask`。

> 完整刪除語意(soft-delete / `status: cancelled`)留到 WSPC 階段,見「銜接 WSPC(Slice 2)的事項」。

### priority ring

- 一般 row(其他計劃內)常駐顯示**虛線空 ring**;點一下把這件升成今日重點(`setDailyPriority`,自動騰位)。
- 已是重點的 task 顯示**實心數字 ring**;點它循環切換 `1 → 2 → 3 → 無`(移除即清掉序號、退回其他計劃內)。

### mobile fallback

窄螢幕沒有 hover,✎ / 🗑 改為常駐顯示(CSS media query 切換)。

## Component 重構

- **`Top3Card`**:從純展示改為可互動,與 `TaskRow` **共用一套互動邏輯**(抽出共用 handlers,例如 `useTaskActions`),視覺維持 accent 卡片風格。今日三件事的 task 也能勾選 / 編輯 / 刪除 / 改序號。
- **`TaskRow`**:checkbox 解除 `disabled`、加 hover 行尾 ✎ / 🗑、加 ring 控制。
- 新增 `AddTaskInput`(常駐輸入列)與 `DeleteUndoToast`。
- `DayColumn` / `TodayLayout` 改從 store 讀;`TodayPage` / `PlanPage` 移除 mock import,改讀 store。

## 測試策略(TDD)

- **store 單元測試(必做)**:逐一覆蓋各 action,重點:
  - `setDailyPriority` 的騰位語意(被騰位者序號被清掉、永遠不重複)
  - `editTitle` 空白取消
  - `deleteTask` / `restoreTask` 還原到原位
  - seed / persist 行為(無存檔 seed、有存檔用存檔、全刪不重生)
- component 互動測試(`@testing-library/react`):勾選、新增、編輯、刪除。
- 既有 derivation 測試(`tasks.test.ts` / `theme.test.ts`)不動。

## 銜接 WSPC(Slice 2)的事項

本片刻意用最小做法,以下衍生事項記錄下來、同步更新到 ROADMAP 的 Slice 2,接 WSPC 時處理:

1. **`today` 真實化 + 可切換日期**:目前固定 `MOCK_TODAY` 且集中在 store 單一欄位。Slice 2 換成真實今天,並支援切換日期(`/today/:date` 之類)。
2. **刪除完整語意**:Slice 1 是「直接刪 + undo」。WSPC 階段改為 soft-delete(PATCH `status: cancelled`),取代從陣列直接移除。
3. **seed → 真實資料**:store 的 initial `tasks = allTasks` 改成由 `/api/todo` list 載入;persist 的角色轉為快取 / 樂觀更新。
4. **`setDailyPriority` 騰位要 patch 兩筆**:被騰位者的 `daily_priority` 清除也需對 server 發 PATCH,不能只改本地。

## 開放細節(留待實作 / writing-plans)

- 手繪 ✓ 與 undo toast 的動畫時長 / 自動消失秒數。
- `useTaskActions` 的確切介面(由 `Top3Card` 與 `TaskRow` 共用驅動)。
- mobile fallback 的斷點數值沿用 Slice 0 既有 breakpoint。
