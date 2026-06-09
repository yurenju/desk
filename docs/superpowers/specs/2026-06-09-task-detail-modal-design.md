# Task 詳情 Modal（description + subtask）設計文件

> 日期：2026-06-09
> 狀態：設計定稿，待寫實作計畫

## 背景與目標

目前 desk 的 task 只在清單列上顯示標題、優先權、完成狀態。WSPC 後端其實每個 todo 都有兩塊更豐富的內容：

- **`description`**：Markdown 文字（CommonMark + GFM table / strikethrough / task list），verbatim 儲存。
- **subtask**：用 `parent_id` 連的子 todo，每個是完整 todo（有自己的 status / title）。WSPC 限制一層巢狀（Root → Child，子 todo 不能再有子 todo）。

但這兩塊在 desk 目前都看不到也改不了：

- [worker/todo-mapper.ts](../../../worker/todo-mapper.ts) 把 WSPC todo 映射成 desk `Task` 時，**完全沒帶 `description`**（`Task.description` 只有 mock data 有值）。
- 前端**完全沒有 subtask / `parent_id` 概念**。

這片要補上一個 **task 詳情 Modal**：點 task 開啟置中對話框，可檢視並**完整編輯** description 與 subtask。

### 為什麼是現在

規劃（Plan）與專注（Focus）兩種鏡頭目前都只能操作 task 的「位置與優先權」，無法記下「這件事的細節」與「要拆成哪幾步」。補上詳情後，desk 才從「排程器」變成能承載實際工作內容的工作面。

## 範圍

- task row 加一個獨立「展開詳情」入口 icon，以及「子任務總數 + 有無描述」徽記。
- 置中 Modal（手機退化為全屏 sheet）顯示與編輯：
  - task 標題（可改）、完成勾選、唯讀脈絡 chips（優先權 / 排定日 / 本月）。
  - description：渲染 Markdown 檢視，點「編輯」切換成 textarea 改原始 Markdown。
  - subtask 清單：勾選完成（toggle）、新增、刪除、改標題；含 `2/3` 完成進度。
- BFF 端點與 mapper 擴充，讓 description 與子任務資料流通。
- 所有編輯即時儲存（沿用既有 patch queue），無「儲存 / 取消」按鈕。

## 非目標

- **subtask 不進三層漏斗**：subtask 是純 checklist，內含於父 task。不排程（無 `scheduled_*`）、不設優先權、不出現在月 / 週 / 日欄、不在 backlog。
- **subtask 不可拖拉排序**（無 `position` 欄位；留後續）。
- **row 徽記不顯示 `2/3` 完成進度**，只顯示總數（理由見「資料與架構」）。`2/3` 進度只在 Modal 內出現。
- 不做 description 的 WYSIWYG 所見即所得編輯（只有「渲染檢視 ⇄ 原始 textarea」兩態）。
- 不動 auth / KV / token / 三層漏斗資料模型。

## UI 與互動設計

### task row 的改動

每個 task row（[src/features/day/TaskRow.tsx](../../../src/features/day/TaskRow.tsx) 與對應的 `MonthRow` / `BacklogRow`）新增：

- **展開 icon**：一個「⤢」按鈕，置於行尾 `⋯` overflow menu 的左邊，點擊開啟詳情 Modal。
- **內容徽記**：當 task 有子任務或有描述時，在標題列下方顯示一行小徽記，例如「`◔ 3 · 有描述`」：
  - 子任務數來自 `subtask_count`（見下）；為 0 時不顯示子任務段。
  - 「有描述」只在 `description` 非空時顯示。
  - 兩者皆空時整行徽記不出現。
- **窄欄與觸控**：展開 icon 沿用現有 `useHoverCapable` 策略——有 hover 的桌機 hover 時才顯示行尾按鈕，無 hover 的觸控裝置常駐，觸控目標 ≥44px。徽記文字常駐（它是資訊，不是動作）。

標題的雙擊 inline 編輯**維持不變**；詳情 Modal 是另一條獨立入口。

### 詳情 Modal

用 `@base-ui/react` 的 Dialog（已有 focus trap / Esc / 點外關閉）。版型由上而下：

1. **標題列**：左側 done checkbox（勾選 = `status: done` + 寫 `done_on`，沿用既有邏輯）、可點擊改寫的標題、右上關閉鈕。
2. **脈絡 chips（唯讀）**：依 task 的 custom fields 顯示，例如「① 今日第一」（`daily_priority`）、「排到 6/9」（`scheduled_dates` 最後一筆）、「本月」（`scheduled_months` 含本月）。純資訊，不可在此編輯。
3. **描述區**：
   - 預設渲染 `description` 的 Markdown。
   - 右上「✎ 編輯」切換成 textarea，內容為原始 Markdown；blur 或關閉時即時 PATCH。
   - description 為空時顯示淡色 placeholder（例如「加上描述…」），點擊即進編輯態。
4. **子任務區**：
   - 進度條 + 「`已完成 / 總數`」（例如 `2 / 3`）。
   - 每筆 subtask：checkbox（toggle status）、標題（點擊 inline 改寫）、hover 顯示刪除鈕。
   - 底部「＋ 新增子任務…」輸入框，Enter 建立。
5. **頁尾**：左下「🗑 刪除任務」（soft-delete，沿用既有 `cancelled` + undo toast）。

**手機**：Modal 改為從底部升起的全屏 sheet，內容相同。

## 資料與架構

### WSPC 能力（已對 OpenAPI 確認）

- **root list 不含子任務**：`GET /todo/items` 省略 `parent_id` 時只回 root-level todo（[wspc-types.ts](../../../worker/wspc-types.ts) line 1235）。因此 subtask 天生不會出現在 desk 的月 / 週 / 日 / backlog 視圖——這些視圖全由現有 root list 推導。
- **`child_count` 免費**：todo record 本身帶 `parent_id` 與 `child_count`（wspc-types.ts line 2412-2413）。root list 一回來，每個 task 就知道有幾個子任務，**不需額外呼叫**。
- **lazy-load 子任務**：官方建議「展開父任務時用 `parent_id` lazy-load 子任務」（wspc-types.ts line 1231）——正對應「開 Modal 才抓子清單」。
- **一層巢狀**：subtask 不能再有 subtask（`PARENT_IS_CHILD`，line 1254），符合 checklist 模型。
- **`description` 是核心欄位**：WSPC todo 預設回傳 `description`，不需改 DeskTask 型態註冊。

### 為什麼 row 徽記只顯示總數

`child_count` 給的是**子任務總數**（免費，已在 root list）。但 `2/3` 的「已完成數」需要對每個有子任務的 task 各抓一次子清單（N 次呼叫），會拉長每次清單載入。權衡後 row 徽記只顯示總數，`2/3` 完成進度移到 Modal 內（開 Modal 本就要抓子清單）。

### 型別與 mapper 擴充

`Task`（[src/lib/types.ts](../../../src/lib/types.ts)）新增兩個欄位：

```ts
export interface Task {
  // ...existing
  description?: string;
  subtask_count?: number; // mapped from WSPC child_count
}
```

worker 端的 `Todo`（[worker/wspc.ts](../../../worker/wspc.ts)）型別補上 `description` 與 `child_count`，mapper（[worker/todo-mapper.ts](../../../worker/todo-mapper.ts)）一併映射：

```ts
export function mapTodoToTask(todo: Todo): Task {
  return {
    // ...existing
    description: todo.description ?? undefined,
    subtask_count: todo.child_count ?? 0,
  };
}
```

### 子任務在前端的存放

子任務不放進主 `tasks` 陣列（它們不是漏斗成員）。改用獨立狀態：

- 一個 `useTaskDetail(taskId)` hook（或 store slice）負責：開 Modal 時抓子清單、持有 `subtasks` 與 loading 狀態、提供 toggle / add / rename / remove 動作。
- 子任務的 mutation 沿用既有 per-id patch queue（[src/lib/api/todoQueue.ts](../../../src/lib/api/todoQueue.ts)），因為 queue 本就以 id 為 key，子 todo 的 id 直接適用。
- **新增 / 刪除子任務後**，樂觀更新主 store 裡父 task 的 `subtask_count`，讓 row 徽記即時同步。

### 子任務建立的細節

- 用同一個 DeskTask `type_id` + `parent_id = 父 task id` 建立，**不帶任何漏斗 custom fields**（`scheduled_*` / priority / `is_adhoc` 都不設）。
- 查子清單時帶 `parent_id` 並只取 `open` / `in_progress` / `done`（排除 `cancelled`，與既有 list 一致），這樣 soft-delete 的子任務自然消失。

## BFF 端點

| 方法 | 路徑 | 行為 |
|---|---|---|
| `GET` | `/api/todo` | mapper 補回 `description` + `subtask_count`（既有端點，擴充映射） |
| `GET` | `/api/todo/:id/subtasks` | `listTodos(parent_id = id)`，回子任務清單 |
| `POST` | `/api/todo/:id/subtasks` | `createTodo(parent_id = id, title)`，回新子任務 |
| `PATCH` | `/api/todo/:id` | 擴充支援 `description`（子任務的 status / title 改寫沿用此端點，子 id 直接適用） |

- **刪除子任務** = `PATCH /api/todo/:childId` 帶 `status: cancelled`（soft-delete，沿用現有路徑）。
- worker 端 `patchTodo`（wspc.ts）已支援 `title` / `status` / `customFields`，再加 `description` 透傳即可。

## 前端結構

- `src/features/task-detail/TaskDetailModal.tsx`：Modal 容器與版型。
- `src/features/task-detail/DescriptionEditor.tsx`：渲染 / 編輯兩態切換（用 `react-markdown` + `remark-gfm` 渲染）。
- `src/features/task-detail/SubtaskList.tsx`：子任務清單 + 新增輸入框。
- `src/features/task-detail/useTaskDetail.ts`：抓子清單、子任務 mutation、`subtask_count` 同步。
- `src/lib/api/todo.ts`：新增 `fetchSubtasks` / `createSubtask`；`TodoPatch` 加 `description`。
- 開啟狀態（目前哪個 task 的 Modal 開著）放一個輕量 store slice 或 URL search param，待實作時定。

## 依賴

- 新增 `react-markdown` + `remark-gfm`（Markdown 渲染）。安裝用 `npm install --legacy-peer-deps`（沿用專案慣例）。

## 測試策略

### 自動化（vitest / Testing Library）

- **mapper**：`mapTodoToTask` 正確帶出 `description` 與 `subtask_count`（含 `child_count` 缺省為 0）。
- **useTaskDetail**：抓子清單、toggle / add / rename / remove 的樂觀更新與 `subtask_count` 同步、失敗回滾。
- **TaskDetailModal**：渲染 Markdown（粗體 / 清單）、編輯態切換、子任務勾選 / 新增 / 刪除 / 改標題、空描述 placeholder。
- **row 徽記**：有 / 無描述、子任務數 0 與 >0 的顯示分支。

### e2e（Playwright，對真實 BFF + mock WSPC）

CLAUDE.md 規定改到 task 互動要連同 e2e 一起更新並在本機跑過。本片新增詳情 Modal 與子任務操作，需：

- e2e mock WSPC upstream 補上：`parent_id` 過濾的 list、`child_count`、`description` 欄位、子任務的 create / patch。
- 新增 `e2e/task-detail.spec.ts`：開 Modal、改描述後重開仍在、新增子任務、勾選子任務、刪除子任務、刪除父任務。

型別檢查一律用 `npm run build`（`tsc -b && vite build`），不用 `tsc -p ... --noEmit`（對 solution-style 根 config 是 no-op 假綠）。測試檔顯式 `import { describe, it, expect } from "vitest"`。

### 手動測試（preview + AI agent）

由 AI agent 透過 `preview_start` 開預覽實機操作，先探測登入狀態：已登入就直接驗收，停在 `/login` 或需真實 WSPC 資料才請使用者協助完成 device flow。對照下方「驗收標準」逐項手動驗收——尤其 Markdown 渲染觀感、Modal 升起 / 全屏 sheet 過場、子任務勾選手感、徽記在窄欄的排版這些單元測試抓不到的部分。

## 驗收標準

1. task row 出現「展開」icon；點擊開啟置中 Modal（手機為全屏 sheet）。
2. 有描述 / 有子任務的 row 顯示「`◔ n · 有描述`」徽記；兩者皆空則無徽記。
3. Modal 內 description 以渲染後的 Markdown 呈現（粗體 / 清單 / 連結正確）。
4. 點「編輯」切到 textarea 顯示原始 Markdown，改完 blur 即時儲存；重開 Modal 內容仍在。
5. 空描述顯示 placeholder，點擊可直接進編輯態並儲存。
6. 子任務區顯示 `已完成 / 總數` 進度，與清單一致。
7. 勾選子任務即時切換完成樣式並寫入 WSPC；重開仍保持。
8. 底部輸入框新增子任務後立即出現在清單，且 row 徽記總數 +1。
9. 子任務可 inline 改標題、可刪除；刪除後從清單消失且 row 徽記總數 −1。
10. 「刪除任務」soft-delete 父任務（沿用既有 cancelled + undo toast）。
11. 子任務完全不出現在月 / 週 / 日 / backlog 任何視圖。
12. 第二個 WSPC 帳號登入只看得到自己的 task 與子任務（multi-tenant 分流不破）。

## 風險與待確認

- **REST `child_count` / `description` 實際回傳**：OpenAPI 宣告有，但本地 `Todo` 型別未宣告。實作第一步先用 `scripts/verify-wspc.mjs` 或 mock 對線上實證 list 回應確含這兩欄，再往下做。
- **子任務 type 與 list 過濾**：確認 `list(parent_id)` 是否需同時帶 `type_id`；若子任務用 DeskTask type 建立，帶 `type_id` 較保險。
- **刪父任務與子任務的關係**（已拍板、可後續細修）：父任務 soft-delete 走 `PATCH status: cancelled`（非 DELETE 端點，故不觸發 `HAS_CHILDREN`），**不連帶處理子任務**。子任務只活在父任務內、其他視圖看不到，留作後續細修。
- **`react-markdown` 體積與安全**：渲染使用者自己的 Markdown，預設不允許原始 HTML（避免 XSS），確認 `react-markdown` 預設行為符合。

## 後續（不在本片）

- 子任務拖拉排序（`position` 欄位）。
- 父任務刪除時連帶處理子任務的明確語意（cascade）。
- row 徽記顯示 `2/3` 完成進度（若日後願意付 N 次拽取成本）。
