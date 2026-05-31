# Slice 2b — `/api/todo` 接上 WSPC + 前端銜接設計

本文件定義 `desk.yurenju.me` 在 Slice 2b 要完成的範圍：把 Today mode 的 task 資料從 localStorage 換成真實 WSPC 資料。沿用 Slice 2a 已跑通的 auth 鏈（device flow + 加密 session + token 自動刷新中間件），新增 `/api/todo` 的 list / create / patch，以及第一次使用時 lazy 建立「Desk 專案 + DeskTask 自訂型態」的 bootstrap。Plan mode 與 Backlog 仍維持唯讀，軌跡 / 略過 / Monthly / carryover 的寫入留給後續 slice。

## 範圍與動機

Slice 2a 把 auth 基礎建設單獨驗證完畢，demo 端點 `/api/me` 證明了 token 真的能授權打 WSPC。2b 是第一片真正碰 todo 資料的 slice，要把 Slice 1 刻意用 localStorage 撐住的 Today mode 換成 WSPC 後端。

### 2b 的明確邊界

| 做 | 不做 |
|---|---|
| Lazy 建立 Desk project + DeskTask type（per-user） | 軌跡（trail）寫入語意 |
| `/api/todo` list / create / patch | 略過 / unschedule（`unscheduled_*`） |
| Today mode 換成真實 WSPC 資料 | Monthly 欄互動 / promote |
| 真實 today + 切換日期 | Backlog 寫入互動 |
| soft-delete 改 PATCH `status: cancelled` | `position` 排序 |
| daily_priority 騰位兩筆 PATCH | carryover banner 動作 |
| 樂觀更新 + 失敗回滾 | Plan mode 可寫（仍唯讀） |

### 與 ROADMAP 的差異（需回填校正）

ROADMAP 的 2b checklist 第一項只寫「`DeskTask` 自訂型態註冊」，**沒列到 project**。但 WSPC 的 todo 都必須屬於某個 active project（list 與 create 都強制 `project_id`），所以「lazy 建立 Desk project + KV 存 project_id」是 type 註冊的前置條件，必須一併納入。本片完成後應把這條補進 ROADMAP。

## 系統架構

部署形態與 2a 相同：單一 Cloudflare Worker 同時 serve 前端 assets 與 `/api/*`。本片在 `DESK_KV` 新增一類 key（per-user bootstrap），並在 session 記錄補存 `user_id`。

```
Browser (useTasksStore)
  │
  │  GET /api/todo?date=2026-05-31
  ▼
Cloudflare Worker (/api/* + withSession)
  │
  ├─ 解析 session → access_token + user_id
  ├─ 解析 bootstrap（KV desk:bootstrap:<user_id>）→ project_id + type_id
  │     未命中 → 用該 user 的 token 建 Desk project + DeskTask type，寫回 KV
  │
  ├─ WSPC: api.wspc.ai
  │     GET   /todo/items?project_id=…&cf.scheduled_dates=<date>&status=…
  │     POST  /todo/items
  │     PATCH /todo/items/{id}
  │     POST  /todo/projects        （bootstrap）
  │     POST  /todo/types           （bootstrap）
  │
  └─ Todo[] ──mapTodoToTask──▶ Task[]（前端形狀）
       │
       ◀── 前端樂觀改 store，背景發 POST/PATCH，失敗回滾
```

核心取捨：**厚 BFF / 薄前端**。BFF 回給前端的就是前端要的 `Task[]`（已過濾、已轉形狀），WSPC 的原生形狀（epoch-ms 時間戳、`custom_fields` map、PATCH 的 null 語意）完全封在 worker 內，前端只認 `Task` 型別。

## WSPC 整合點

全部走 `https://api.wspc.ai`。沿用 2a 的 snapshot + 顯式 sync 模式（`spec/wspc-openapi.json` + `openapi-typescript`）。

### ⚠️ `cf` 自訂欄位過濾：未文件化但已實證

關鍵發現：`GET /todo/items` 支援用 custom field 過濾，但**主 OpenAPI（`https://api.wspc.ai/openapi.json`）並沒有文件化這個參數**。它只出現在 WSPC 的 MCP tool schema 與 `https://wspc.ai/llms.txt`。為了不憑文件臆測，本片用 `scripts/verify-wspc.mjs`（零依賴 Node 工具，走完整 device flow）對線上 API 實打驗證，結果：

| 行為 | 實測結果 |
|---|---|
| `?cf.scheduled_dates=<date>`（點號語法） | ✅ 對 `string_array` 做真正的 **array-contains** 過濾 |
| `?cf[scheduled_dates]=<date>`（中括號語法） | ❌ 無效，被忽略、回傳全部 |
| `?cf.<未宣告欄位>=x` | ⚠️ 回 **HTTP 200**（非 422）→ **靜默忽略、回傳整包** |
| `sort_by=cf.<string-key>` | ✅ 正常排序 |
| `sort_by=cf.<string_array-key>` | ✅ 回 422 `INVALID_SORT_KEY`（如預期不支援） |

**對設計的兩個影響：**

1. `scheduled_dates contains today` 可以在 server 端用 `cf.scheduled_dates=<today>`（點號）完成，不必把整個 project 拉回前端過濾。
2. **打錯 cf key 不會報錯，而是靜默回傳整包資料。** 這是最危險的陷阱——filter key 拼錯會悄悄拿到「整個 project 的 task」而非當天的。對策見「cf key 防呆」。

因為 `cf` 未進 OpenAPI，`worker/wspc-types.ts` 不會有它的型別，cf query 一律手組字串，不靠 generated types；`scripts/verify-wspc.mjs` 作為這個未文件化行為的回歸檢查保留在 repo。

### 1. List todos

```
GET /todo/items?project_id=<id>
              &cf.scheduled_dates=2026-05-31
              &status=open&status=in_progress&status=done
Authorization: Bearer <access_token>
```

- `project_id`：必填，從 bootstrap 取。
- `cf.scheduled_dates=<date>`：array-contains 過濾，取出當天該顯示的候選集（含順延 / 略過軌跡——它們的 `scheduled_dates` 也含該日；primary vs 軌跡的區分仍由前端既有 derivation 處理）。
- `status`：帶 `open` / `in_progress` / `done`（看得到當天已完成的 task），排除 `cancelled`（soft-delete）。

回傳 `{ todos: Todo[] }`。

### 2. Create todo

```
POST /todo/items
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "<使用者輸入>",
  "project_id": "<bootstrap>",
  "type_id": "<bootstrap>",
  "custom_fields": {
    "scheduled_dates": ["2026-05-31"],
    "is_adhoc": "true"
  }
}
```

對應前端 Today mode 的「+ 加一件今天的事」入口。BFF 補上 `project_id` / `type_id` / `scheduled_dates:[today]` / `is_adhoc:"true"`，前端只送 `{ title }`。回傳完整 `Todo`，map 成 `Task` 回前端（自然取得 WSPC 的 `tod_…` id 取代前端 `crypto.randomUUID()`）。

### 3. Patch todo

```
PATCH /todo/items/{id}
Authorization: Bearer <access_token>
Content-Type: application/json

# 例：勾選完成
{ "status": "done", "custom_fields": { "done_on": "2026-05-31T..." } }

# 例：取消完成
{ "status": "open", "custom_fields": { "done_on": null } }

# 例：設 daily_priority
{ "custom_fields": { "daily_priority": "1" } }

# 例：改標題（core 欄位，top-level）
{ "title": "新標題" }

# 例：被騰位者清除 priority
{ "custom_fields": { "daily_priority": null } }

# 例：soft-delete
{ "status": "cancelled" }
```

WSPC PATCH 語意（實證自 OpenAPI）：只有 body 帶到的 key 會變、帶 `null` 才刪除該 custom field、陣列值整包替換。**前端不直接送這個形狀**——前端送語意化的部分 `Task`（見「Mutation 契約」），BFF 翻譯成上面這些 WSPC PATCH。

### 4. Bootstrap：建 project 與 type

```
POST /todo/projects
{ "name": "Desk" }
# → { id: "prj_…", default_todo_type_id: "typ_…", … }

POST /todo/types
{
  "label": "DeskTask",
  "project_id": "prj_…",
  "custom_fields": [
    { "key": "scheduled_months",  "type": "string_array" },
    { "key": "scheduled_dates",   "type": "string_array" },
    { "key": "unscheduled_month", "type": "string" },
    { "key": "unscheduled_at",    "type": "string" },
    { "key": "monthly_priority",  "type": "string" },
    { "key": "daily_priority",    "type": "string" },
    { "key": "is_adhoc",          "type": "string" },
    { "key": "done_on",           "type": "string" },
    { "key": "position",          "type": "string" }
  ]
}
# → { id: "typ_…", … }
```

**一次宣告完整 9 欄位**，即使 2b 只用到 `scheduled_dates` / `daily_priority` / `done_on` / `is_adhoc`。其餘（`scheduled_months`、`unscheduled_*`、`monthly_priority`、`position`）先宣告好，讓 Slice 3/4/5/7 加 Monthly / Backlog / 軌跡 / 排序時不必再改 type。custom field key 規範：`^[a-z][a-z0-9_]{0,63}$`，只支援 `string` 與 `string_array` 兩種型別——與資料模型完全對得上。

## KV 結構

沿用 2a 的 `DESK_KV`，本片新增一類 key 並擴充 session 內容。

| Key | Value 形態 | TTL | 寫入時機 |
|---|---|---|---|
| `wspc:client_id` | 字串 | 永久 | （2a）lazy 註冊 |
| `session:<id>` | JSON：`{ access_token, refresh_token, access_exp, user_id }` | 30 天 | （2a）device flow 成功；**本片新增 `user_id`** |
| `device:<polling_id>` | JSON | `expires_in` 秒 | （2a）device flow 期間 |
| `desk:bootstrap:<user_id>` | JSON：`{ project_id, type_id }` | 永久 | **本片新增**：該 user 第一次打 `/api/todo` 時 lazy 建立 |

### Bootstrap 為什麼 per-user

這是 multi-tenant 的正確性關鍵。Bootstrap 建出來的 Desk project 屬於「執行建立的那個 token 對應的 WSPC 帳號」。若 bootstrap 快取存成單一全域 key，第二個使用者來會讀到第一個使用者的 `project_id`，拿自己的 token 去 list/create 那個 project → WSPC 回 `NOT_FOUND`（跨帳號 project），整個壞掉。

所以快取必須 **per-user**，key 帶 `user_id`（不是全域、也不是 per-session——一個人可能有多個 session）。**每個新使用者第一次來都會跑一樣的 bootstrap 檢查**：查自己的 `desk:bootstrap:<user_id>` 未命中 → 在自己的帳號建 Desk project + DeskTask type → 存自己的 key。User A / User B 各有各的 project/type，自然分流。

### 取得 user_id

組 `desk:bootstrap:<user_id>` 需要 user_id。2a 的 `withSession` 目前只交出 access_token。本片在**登入建立 session 時把 user_id 一併寫進 `session:<id>`**（device flow 成功後已能呼叫 WSPC `/auth/me` 取得），讓 bootstrap 不必每次請求多打一趟 `/auth/me`。`withSession` 擴充為同時交出 `{ accessToken, userId }`。

### Bootstrap 的 race（已知極小風險）

同一個使用者並發的「第一次 `/api/todo`」可能同時看到 KV 未命中、各建一個 Desk project（WSPC project 名稱不唯一，擋不掉重複）。後果是該帳號多一個未使用的 Desk project，功能上不影響（後續以 KV 內最後寫入的 `project_id` 為準）。單人、手動操作的場景 window 極窄，**不做 lock**，僅記為 known limitation。

## Worker 路由

掛在現有 `worker/index.ts` 的 dispatcher，全部包在 `withSession` 後（需要 WSPC 授權）。Bootstrap 解析作為這三條 handler 的共同前置步驟。

### `GET /api/todo?date=YYYY-MM-DD`

1. `withSession` → `{ accessToken, userId }`。
2. 解析 bootstrap → `{ project_id, type_id }`（未命中則建立）。
3. 呼叫 WSPC `GET /todo/items`，帶 `project_id`、`cf.scheduled_dates=<date>`、`status=open&status=in_progress&status=done`。
4. `Todo[]` 經 `mapTodoToTask` 轉成 `Task[]` 回前端。
5. `date` 由前端必帶（預設真實今天，切換日期時帶該日）；BFF 不自行假設今天，避免 worker 時區與使用者不一致。缺 `date` 時回 400。

### `POST /api/todo`

1. `withSession` + bootstrap。
2. body `{ title }`（語意化）。BFF 組 WSPC create body（補 project_id / type_id / scheduled_dates:[today] / is_adhoc:"true"）。
3. 回傳 map 後的 `Task`。

### `PATCH /api/todo/:id`

1. `withSession` + bootstrap。
2. body 為語意化部分欄位：`{ title?, status?, daily_priority?, done_on? }`，其中 `daily_priority` / `done_on` 可為 `null`（表示清除）。
3. BFF 翻譯成 WSPC PATCH：`title` / `status` 進核心欄位（top-level）；`daily_priority` / `done_on` 進 `custom_fields`（`null` 即刪除）。
4. 回傳 map 後的 `Task`。

soft-delete 走 `PATCH { status: "cancelled" }`（不是 `DELETE /todo/items/{id}`），語意上貼近「使用者取消」，且 list 預設不回 cancelled。

### cf key 防呆

因為實測「打錯 cf key 靜默回整包」，過濾欄位名寫成常數（如 `const CF_SCHEDULED_DATES = "cf.scheduled_dates"`），並加一個單元測試鎖死這個字串與 query 組裝結果，避免重構時悄悄改錯 key 而拿到別天的資料。

## Todo ↔ Task 形狀轉換

WSPC `Todo` 與前端 `Task`（`src/lib/types.ts`）形狀不同，BFF 用純函式 `mapTodoToTask` 把 `Todo` 轉成前端 `Task`（獨立檔、獨立測試）。反方向（前端語意 → WSPC create/patch body）由各 route handler 組裝，不走這個函式。

| 面向 | WSPC `Todo` | 前端 `Task` |
|---|---|---|
| id | `tod_…` | 同字串 |
| 時間戳 | `created_at` / `updated_at`：epoch-ms `number` | ISO string |
| custom fields | `custom_fields` map（值為 string \| string[]） | 攤平進 `custom_fields: TaskCustomFields` |
| status | `open/in_progress/done/cancelled` | 同 enum |
| `done_on` | 在 `custom_fields` 內 | 在 `custom_fields` 內 |

不使用 WSPC 核心 `due_at`（資料模型用 `scheduled_dates` 表達排定日期）。

## 前端改動

只動 Today mode 的資料流；Plan / Backlog 仍唯讀（但需正確讀新的 store）。

### store 換源（`useTasksStore`）

- 移除 seed-from-mock：`tasks: allTasks` 改由 `GET /api/todo` 載入當天資料。
- 新增 `status: "loading" | "ready" | "error"`，承載載入生命週期（見「載入狀態」）。
- `persist` 角色從「資料源」降為「快取 / 樂觀更新暫存」。
- **登出時清掉快取**：multi-tenant，避免把某帳號的 todo 留在 localStorage 被下一個登入者看到。`useAuthStore.clear()` 時連帶清 `useTasksStore` 的持久化資料。

### 載入狀態（含首次 bootstrap）

bootstrap 是 lazy、發生在第一次 `GET /api/todo` 的 BFF 內部（串 createProject → createTodoType → listTodos），對前端是隱形的——只是「第一次 load 比較久」。因此**不做專屬的「初始化中」畫面**，而是讓 tasks store 有一個一般性的載入狀態，由它統一吸收首次 bootstrap 的延遲，同時也補掉切換日期時沒有 loading 回饋的缺口。

- `loadTasks(date)`：開始時設 `status: "loading"`，成功 `ready`、失敗 `error`。
- Today 在 `status === "loading"` 顯示 skeleton / spinner；`error` 顯示錯誤訊息 + 重試入口；`ready` 且 `tasks` 為空顯示既有空狀態。
- 首次使用：登入後進 Today → 看到 loading → bootstrap + list 完成 → 顯示（空的）當天清單。無專屬文案，與一般載入一致。

### 真實日期 + 切換

- 以 `new Date()` 取代 `MOCK_TODAY`。
- route 加選擇性 `/today/$date`（預設真實今天）；切換日期重新 `GET /api/todo?date=`。

### 樂觀更新 + 失敗回滾

每個 mutation：

1. 先以 Slice 1 既有的 `taskOps` 純函式更新 store（保留即時手感）。
2. 背景發對應的 `POST` / `PATCH`。
3. 成功：以回傳的 `Task` 對帳（confirm）。
4. 失敗：回滾到動作前快照 + 顯示 toast。

### daily_priority 騰位（前端編排兩筆 PATCH）

priority 1/2/3 唯一。把 X 設為某 priority 時，原持有者 Y 要被騰開：

1. 前端用既有純函式算出被騰者 Y。
2. 樂觀更新本地（X 設值、Y 清除）。
3. 依序發兩筆 PATCH：`PATCH X { daily_priority: "n" }`、`PATCH Y { daily_priority: null }`。
4. 任一筆失敗 → 兩筆都回滾 + toast（WSPC 無 transaction，靠前端維持一致性）。

### 不動的部分

- Plan / Backlog 的版型與唯讀渲染。
- 軌跡（forwarded / dismissed）的渲染邏輯（Slice 0 既有，仍只讀）。

## 錯誤處理

| 狀況 | 行為 |
|---|---|
| `GET /api/todo` 失敗（含 bootstrap 失敗） | store `status: "error"`，Today 顯示錯誤訊息 + 重試入口 |
| 首次 / 切日載入中 | store `status: "loading"`，Today 顯示 skeleton / spinner |
| mutation（POST/PATCH）失敗 | 回滾樂觀更新 + 失敗 toast（`DeleteUndoToast` 讀 store `error`，`儲存失敗` role="alert"，自動消失） |
| 騰位兩筆其一失敗 | 兩筆一起回滾 + 失敗 toast |
| 刪除（soft-delete）成功 | 顯示 undo toast（`已刪除「title」`+ 復原）；復原 = re-insert + PATCH 回原 status；restore 失敗保留 undo 可重試 |
| 401（session 過期、中間件 refresh 也失敗） | 導去 `/login` |
| bootstrap 失敗（建 project/type 報錯） | 當成 error 浮上來，不靜默吞掉 |
| cf key 拼錯（防呆未攔到） | 由常數 + 測試於開發期擋下，不到 runtime |

## 測試策略

### 單元測試（Vitest）

- **`mapTodoToTask`**：epoch-ms → ISO、custom_fields 攤平、status 對應、缺欄位處理。
- **Bootstrap**：KV 未命中 → 呼叫 project/type create + 寫回 KV；KV 命中 → 直接重用、不重建；per-user key 正確（不同 user_id 各自 bootstrap）。
- **三條 route handler**（KV stub + mock WSPC fetch）：
  - GET 組出正確的 `cf.scheduled_dates` + `status` query；map 結果正確。
  - POST 補上 project/type/scheduled_dates/is_adhoc。
  - PATCH 把語意 body 翻成正確的 WSPC PATCH（含 `null` 清除）。
- **cf key 常數鎖定**：assert query 組裝字串為 `cf.scheduled_dates=...`，防靜默回整包。
- WSPC 呼叫用 `fetch` mock 攔截；KV 用既有 stub。

### 前端測試

- store 從 `GET /api/todo` 載入。
- 樂觀更新 + 失敗回滾（mock 請求失敗，assert 回到動作前狀態 + toast）。
- 騰位兩筆 PATCH 的編排與整體回滾。
- 切換日期重新 fetch。
- 登出清空 task 快取。
- 重用既有 `taskOps` 測試（純函式不變）。

### 線上驗證

- `scripts/verify-wspc.mjs` 作為 `cf` 行為的回歸檢查（手動跑）。
- 部署後手動：登入 → Today 顯示真實 WSPC 資料 → 新增 / 勾選 / 編輯 / 刪除 / 設 priority → 刷新後資料仍在（來自 WSPC，不只 localStorage）→ 切換日期 → 第二帳號登入看到的是自己的資料。

## 不做（明確）

- 軌跡（trail）的寫入語意、forwarded / dismissed 的動作：Slice 5。
- 略過 / unschedule（`unscheduled_at` / `unscheduled_month`）：Slice 5。
- Monthly 欄互動 / promote / `monthly_priority` 寫入：Slice 3。
- Backlog 寫入互動：Slice 4。
- carryover banner 動作 / 判定：Slice 6。
- `position` 排序：Slice 7。
- Plan mode 可寫：仍唯讀。
- bootstrap race lock：known limitation，單人情境不值得。

## 驗收標準

1. 從 `https://desk.yurenju.me` 登入後，Today mode 顯示的是真實 WSPC 資料（非 mock / localStorage）。
2. 第一次使用會自動建立 Desk project + DeskTask type，`desk:bootstrap:<user_id>` 寫入 KV；第二次起重用、不重建。
3. 新增 / 勾選完成 / 取消完成 / inline 編輯 / 刪除（soft-delete）/ 設 daily_priority 全部寫進 WSPC，刷新後資料仍在。
4. daily_priority 騰位正確發兩筆 PATCH，被騰者的 priority 在 server 端被清除。
5. mutation 失敗時 UI 回滾並提示，不留下與 server 不一致的狀態。
6. 切換日期能載入該日資料。
7. 第二個 WSPC 帳號登入看到的是自己的 todo（multi-tenant 分流正確），且兩帳號的 bootstrap 互不干擾。
8. 登出後 task 快取被清空，下一個登入者看不到前一人的資料。
9. 後端單元測試（mapping、bootstrap、三 route、cf key 鎖定）與前端測試全綠。
10. Plan / Backlog 兩個 mode 與 Slice 1 一致（無 regression）。

## ROADMAP 校正（本片完成後回填）

- 2b checklist 補一條：「lazy 建立 Desk project + KV 存 `project_id`（per-user）」，放在 DeskTask type 註冊之前。
- 標註 `cf` 為未文件化但已實證的依賴，並指向 `scripts/verify-wspc.mjs`。
