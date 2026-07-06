# Task 留言（comment）設計文件

> 日期：2026-07-07
> 狀態：設計定稿，待寫實作計畫

## 背景與目標

WSPC backend 新提供 todo comment API：每則 comment 是獨立實體，掛在單一 todo 底下，內容為純文字（1 到 10000 字），支援建立、列表（含分頁）、編輯、soft-delete。desk 目前完全沒有 comment 概念。

本片在既有的**任務詳情 Modal**（[src/features/task-detail/TaskDetailModal.tsx](../../../src/features/task-detail/TaskDetailModal.tsx)）內新增「留言」區，讓任務可以累積過程紀錄：中途的想法、卡住的原因、跟 AI agent 往返的脈絡（wspc MCP 也有 `todo_comment_*` 工具，agent 寫入的留言會在這裡看到）。

## 範圍

- Modal 內 subtask 區下方新增留言區：檢視列表、新增、編輯、刪除（完整 CRUD）。
- BFF 新增四個 proxy 端點與對應的 `worker/wspc.ts` client 函式。
- 更新 WSPC OpenAPI snapshot 與產生的型別（`npm run wspc:sync` + `npm run wspc:generate`）。
- wspc-fake 補 comment 端點，e2e 覆蓋加 / 改 / 刪。

## 非目標

- **task row 不顯示留言數徽記**：todo record 沒有 comment count 欄位，要顯示得每個 task 多打一次 API，成本過高。開 Modal 才載入。
- **不做 Markdown 渲染**：留言是短訊息性質，純文字 + 保留換行即可；之後有需要再加。
- **不做分頁 UI**：一次抓 `limit=100`，個人儀表板夠用（程式碼留 `ponytail:` 註記，需要時再接 `next_cursor`）。
- **不顯示作者**：單人使用，只顯示時間。
- 不做留言的 undo toast（wspc 端是 soft-delete，可從後端復原）。

## WSPC API（已對線上 OpenAPI 確認，2026-07-07）

| 方法 | 路徑 | 說明 |
|---|---|---|
| `POST` | `/todo/items/{id}/comments` | 新增，body `{ content }`，回 `Comment` |
| `GET` | `/todo/items/{id}/comments` | 列表，query `order` / `include_deleted` / `limit` / `cursor`，回 `{ comments, next_cursor? }` |
| `PATCH` | `/todo/comments/{id}` | 編輯，body `{ content }`，回 `Comment` |
| `DELETE` | `/todo/comments/{id}` | soft-delete，回 `Comment` |

`Comment` 形狀：`{ id, todo_id, user_id, org_id, content, created_at, updated_at, deleted_at? }`，時間為整數（epoch）。`content` 限 1 到 10000 字。

本地 snapshot（`spec/wspc-openapi.json`）尚未包含這些端點，實作第一步先 `npm run wspc:sync` + `npm run wspc:generate` 更新 `worker/wspc-types.ts`。

## UI 與互動設計

留言區放在 Modal 內 subtask 區下方、頁尾之上：

1. **標題列**：「留言」+ 則數（載入後顯示，例如「留言 3」）。
2. **列表**：由舊到新排列。每則顯示：
   - 內容：純文字，保留換行（`white-space: pre-wrap`）。
   - 相對時間（例如「3 天前」），以 `updated_at` 顯示；被編輯過（`updated_at > created_at`）時附註「（已編輯）」。
   - hover 顯示「✎ 編輯」「🗑 刪除」兩個小 icon；無 hover 的觸控裝置常駐（沿用既有 `useHoverCapable` 策略），觸控目標 ≥44px。
3. **新增**：底部一個 textarea 輸入框（單行起跳、隨內容長高），Enter 送出、Shift+Enter 換行；也有送出按鈕。送出後清空輸入框，新留言樂觀加到列表尾端。
4. **編輯**：點「編輯」把該則切成 textarea（帶原內容），Enter 或 blur 儲存、Esc 取消。
5. **刪除**：點「🗑」直接刪除（樂觀移除，失敗回滾）。不做確認對話框、不做 undo。
6. **空狀態**：無留言時只顯示輸入框，不顯示空列表文字。
7. **載入中**：開 Modal 時抓留言，載入期間該區顯示淡色 skeleton 或「載入中…」。

## 資料與架構

### BFF 端點

| 方法 | desk 路徑 | 行為 |
|---|---|---|
| `GET` | `/api/todo/:id/comments` | `listComments(id, limit=100, order=asc)`，回映射後的陣列 |
| `POST` | `/api/todo/:id/comments` | `createComment(id, content)`，回新留言 |
| `PATCH` | `/api/todo/comments/:id` | `updateComment(id, content)`，回更新後留言 |
| `DELETE` | `/api/todo/comments/:id` | `deleteComment(id)`，回 204 |

- 全部走既有 `withSession()` middleware（Bearer token、refresh 均沿用）。
- mapper 只留前端需要的欄位：`{ id, content, created_at, updated_at }`（`user_id` / `org_id` / `todo_id` 不透出）。
- `worker/wspc.ts` 新增四個函式，型別取自更新後的 `wspc-types.ts`。

### 前端狀態：獨立 `useComments` hook（不走 patch queue）

comment 是離散實體：整則新增、整則改寫、整則刪除，沒有 title / description 那種連續打字需要 coalescing 的特性，因此**不用** per-id patch queue，也不進 `useTasksStore`（comment 不是漏斗資料）。

- `src/features/task-detail/useComments.ts`：以 `taskId` 為參數。Modal 開啟（留言區 mount）時抓一次列表；提供 `add` / `edit` / `remove` 三個動作，全部樂觀更新、失敗回滾並顯示錯誤（沿用專案既有錯誤提示方式）。
- `src/features/task-detail/CommentSection.tsx`：列表 + 輸入框 + 每則的編輯 / 刪除 UI。
- `src/lib/api/todo.ts`：新增 `fetchComments` / `createComment` / `updateComment` / `deleteComment` 四個 fetch 函式與 `Comment` 前端型別。

## 測試策略

### 自動化（vitest / Testing Library）

- **useComments**：載入列表、add / edit / remove 的樂觀更新與失敗回滾。
- **CommentSection**：空狀態只有輸入框、列表渲染（換行保留、已編輯附註）、Enter 送出 / Shift+Enter 換行、編輯態切換與 Esc 取消、刪除後從列表消失。
- **worker routes**：四個端點的授權（未登入 401）、參數透傳、mapper 欄位裁切。
- 測試檔顯式 `import { describe, it, expect } from "vitest"`；型別檢查一律 `npm run build`。

### e2e（Playwright，對真實 BFF + mock WSPC）

- wspc-fake 補上四個 comment 端點（in-memory 儲存、`__reset` 一併清空）。
- 新增 `e2e/task-comments.spec.ts`：開 Modal 新增留言後重開仍在、編輯留言內容更新、刪除後消失。
- 跑 e2e 前先停掉 preview dev server（port / KV session 衝突，見 CLAUDE.md）。

### 手動測試（preview + AI agent）

由 AI agent 依 CLAUDE.md 的登入探測 SOP（playwright-cli + 共用 profile，`/api/me` 200 即直接開始）開 preview 實機驗收：對照下方驗收標準逐項操作，特別看留言區在 Modal 內的排版、觸控目標、多行留言的換行呈現、與 wspc MCP `todo_comment_create` 寫入的留言是否正確顯示。

## 驗收標準

1. 開任務詳情 Modal，subtask 區下方出現留言區；無留言時只有輸入框。
2. 輸入文字按 Enter（或送出按鈕）新增留言，立即出現在列表尾端；重開 Modal 仍在。
3. Shift+Enter 可換行，送出後換行正確保留顯示。
4. 點「編輯」可改留言內容，儲存後顯示「（已編輯）」附註；重開 Modal 內容仍為新值。
5. 點「刪除」留言立即消失；重開 Modal 不再出現。
6. 透過 wspc MCP `todo_comment_create` 加的留言，重開 Modal 後可看到。
7. 留言操作不影響任務的漏斗欄位（排程 / 優先權不變）。
8. 未登入時 comment 端點回 401。

## 風險與待確認

- **snapshot 更新的連帶差異**：`npm run wspc:sync` 會拉整份最新 spec，可能夾帶 comment 以外的 schema 變動，`wspc:generate` 後要跑 `npm run build` 確認既有程式碼沒被新型別弄壞。
- **`DELETE /todo/comments/{id}` 的回應**：OpenAPI 宣告回 `Comment`（soft-delete 後的實體），BFF 統一轉成 204 即可，前端不需要它。
- **list 的預設排序**：OpenAPI 有 `order` 參數但未確認預設值，BFF 明確帶 `order=asc`（由舊到新）避免依賴預設。

## 後續（不在本片）

- 分頁（接 `next_cursor`，留言超過 100 則時）。
- Markdown 渲染、作者顯示（多人 org 情境）。
- task row 留言數徽記（若 backend 之後在 todo record 補 count 欄位）。
