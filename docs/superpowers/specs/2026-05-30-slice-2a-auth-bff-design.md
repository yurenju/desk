# Slice 2a — Auth + BFF 骨架設計

本文件定義 `desk.yurenju.me` 在 Slice 2a 要完成的最小可 demo 範圍：把 WSPC OAuth 2.1 device flow、加密 session、token 自動刷新中間件接起來，並用一個 `/api/me` 端點證明 token 真的能授權打 WSPC。Slice 2a 完全不處理 todo 資料，Today / Plan / Backlog 三個 mode 仍走 Slice 1 的 localStorage 路線。

## 範圍與動機

### 為什麼從 Slice 2 拆出 2a

原本的 Slice 2 同時要做「auth 基礎建設」與「`/api/todo` 端點 + 前端 4 項銜接（today 真實化、soft-delete、seed 改載入、daily_priority 騰位兩筆 patch）」。實際上兩者各有不同的風險：

- auth 基礎建設一旦寫錯（cookie 設定、refresh 鏈、KV race），後續所有 endpoint 都會踩到，必須先單獨驗證。
- `/api/todo` 牽涉 WSPC `DeskTask` custom type 註冊、custom fields 行為、前端 store 從 mock seed 改成 API 載入 —— 這部分有自己的設計選擇要做，混在一起會讓兩件事都拖。

2a 切出來只做 auth 鏈，demo 端點是 `/api/me`（讀 WSPC 自己的 whoami），證明從 device flow 拿到的 token 真的能授權打 WSPC API。2b 再處理 todo 端點與前端銜接。

### 2a 的明確邊界

| 做 | 不做 |
|---|---|
| Device flow 完整鏈（含註冊 client） | 任何 `/api/todo` 端點 |
| Session 中間件（cookie + KV + refresh） | DeskTask custom type 註冊 |
| `/api/me` proxy 到 WSPC `/auth/me` | 任何 todo CRUD |
| 前端登入頁面 + header 登入狀態 | 前端資料源切換（Today 仍 localStorage） |
| Owner 防護：**不鎖**，任何人可登入看自己 | 鎖定特定 user / email allowlist |

## 系統架構

部署形態跟 Slice 0 一樣：單一 Cloudflare Worker 同時 serve 前端 assets 與 `/api/*` 路由。新增的是 KV namespace `DESK_KV`，用來存三類東西（client_id、session、device flow polling state）。

```
Browser
  │
  │  HTTPS desk.yurenju.me
  ▼
Cloudflare Worker (assets + /api/*)
  │
  ├─ KV: DESK_KV
  │    wspc:client_id           （單筆，lazy 註冊）
  │    session:<id>             （登入後建立，含 token）
  │    device:<polling_id>      （device flow polling 期間暫存）
  │
  └─ WSPC: api.wspc.ai
       POST /auth/oauth/register
       POST /auth/oauth/device
       POST /auth/oauth/token
       GET  /auth/me
```

## WSPC 整合點

四個端點，全部走 `https://api.wspc.ai`。Live OpenAPI 在 `https://api.wspc.ai/openapi.json`，本專案會 snapshot 一份到 `spec/wspc-openapi.json` 並用 `openapi-typescript` 產生 TypeScript 型別供 `worker/wspc.ts` 引用（見「OpenAPI 型別產生」一節）。OAuth 端點的 request / response 形狀都從產生的型別取，不再手寫 interface。

各端點的 request encoding 依 OAuth 規範：register 用 JSON（RFC 7591），device authorization 與 token endpoint 用 `application/x-www-form-urlencoded`（RFC 6749 / RFC 8628）。

### 1. Dynamic Client Registration

```
POST /auth/oauth/register
Content-Type: application/json

{
  "client_name": "desk.yurenju.me",
  "redirect_uris": ["https://desk.yurenju.me/login"],
  "token_endpoint_auth_method": "none",
  "grant_types": [
    "refresh_token",
    "urn:ietf:params:oauth:grant-type:device_code"
  ]
}
```

回傳含 `client_id`。Worker 在第一次 `/api/auth/login` 被呼叫時檢查 `DESK_KV` 有沒有 `wspc:client_id`，沒有就註冊一次寫進去。

幾個欄位必須顯式帶：

- **`grant_types`**：WSPC OpenAPI 的預設值是 `["authorization_code", "refresh_token"]`，**不含 device_code**。不顯式帶 device_code grant，後續 device flow 會被 WSPC 拒絕。
- **`token_endpoint_auth_method: "none"`**：我們是 public client（前端走 device flow），沒有 client secret。雖然 WSPC 預設值就是 `none`，顯式帶比較不會踩到未來預設值改變的雷。
- **`redirect_uris`**：device flow 用不到 redirect，但 RFC 7591 規範要求非空陣列，填一個合理 placeholder（這邊用 desk 自己的 `/login`）。

### 2. Device Authorization

```
POST /auth/oauth/device
Content-Type: application/x-www-form-urlencoded

client_id=<從 KV 讀>
```

回傳：

```
{
  "device_code": "...",
  "user_code": "ABCD-1234",
  "verification_uri": "https://app.wspc.ai/device",
  "verification_uri_complete": "https://app.wspc.ai/device?user_code=ABCD-1234",
  "expires_in": 600,
  "interval": 5
}
```

`verification_uri_complete` 已含 user_code，使用者點開不需要手動輸入。前端直接開新分頁導過去。

### 3. Token Exchange & Refresh

```
POST /auth/oauth/token
Content-Type: application/x-www-form-urlencoded

# Device flow grant：
grant_type=urn:ietf:params:oauth:grant-type:device_code
&device_code=...
&client_id=...

# Refresh grant：
grant_type=refresh_token
&refresh_token=...
&client_id=...
```

回傳：

```
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 900,           // 約 15 分鐘
  "refresh_token": "...",      // 每次刷新會 rotate
  "scope": "wspc:full"
}
```

Device flow polling 期間，未授權時 WSPC 會回 4xx 並在 body 帶 error code。**WSPC 的 error response 形狀有兩種**，要兩種都接：

```
# 形狀 A — RFC 8628 標準
{ "error": "authorization_pending" }

# 形狀 B — WSPC envelope
{ "error": { "code": "AUTHORIZATION_PENDING", "message": "..." } }
```

實作上的解析方式：拿到 body 後檢查 `error` 欄位的型別 — 字串就直接用、物件就取 `error.code`；最後一律 `toLowerCase()` 後比對。Error code 包括 `authorization_pending`、`slow_down`、`access_denied`、`expired_token`，授權成功才回 200 + 上面的 token。

`slow_down` 收到時把 polling interval 增加固定 5 秒（不是倍增），這跟 wspc-cli 一致。

### 4. Whoami

```
GET /auth/me
Authorization: Bearer <access_token>
```

回傳 `{ user_id, email, display_name }`。Slice 2a 的 demo 端點 `/api/me` 就是把這個直接 passthrough（過中間件解密 session、若需要就先 refresh）。

## KV 結構

只用一個 namespace `DESK_KV`，三類 key：

| Key | Value 形態 | TTL | 寫入時機 |
|---|---|---|---|
| `wspc:client_id` | 字串（client_id） | 永久 | 第一次 `/api/auth/login` 時若不存在則 lazy 註冊 |
| `session:<id>` | JSON：`{ access_token, refresh_token, access_exp }` | 30 天 | Device flow 成功後建立；refresh 時原地覆寫 |
| `device:<polling_id>` | JSON：`{ device_code, interval, expires_at }` | WSPC 回傳的 `expires_in` 秒 | `/api/auth/login` 時建立；成功或過期後刪除 |

- `<id>` 與 `<polling_id>` 都是 256-bit 隨機字串（用 `crypto.getRandomValues` 產生，base64url 編碼）。
- Session TTL 30 天是 cookie 與 KV 對齊的取捨：太短會被迫頻繁重登，太長則 session 在 KV 佔位（個人 app 影響極小）。WSPC 沒文件化 refresh token 的實際壽命，到期失效會在下一次 refresh 時自然偵測到。
- KV 全球 eventually consistent，跨 colo 寫入有秒級傳播。對個人 app 從單一裝置操作的場景，實務上感受不到；若使用者切網路換 colo 時碰上，最壞情況是同一個 session 短時間內多 refresh 一次。

### Client_id 註冊的 race 處理

兩個 request 同時觸發第一次 `/api/auth/login` 時可能同時偵測到 KV 沒有 `wspc:client_id`、各自向 WSPC 註冊一個，最後其中一筆覆寫另一筆。後果只是 WSPC 那邊多一筆未使用的 client 紀錄，功能上沒影響，個人 app 部署頻率極低、實際幾乎不會發生。不做 lock。

## Worker 路由

`/api/*` 由 Worker 處理，其餘交給 assets handler（Slice 0 已配 `run_worker_first: ["/api/*"]`）。本片新增以下四條，其他 `/api/*` 一律回 `404`（留給 2b）。

### `POST /api/auth/login`

啟動 device flow。

流程：

1. 從 KV 讀 `wspc:client_id`，若不存在則呼叫 WSPC `/auth/oauth/register` 註冊一個並寫回 KV。
2. 呼叫 WSPC `/auth/oauth/device`，拿到 device_code 與其他 polling 資訊。
3. 產生隨機 `polling_id`，把 `{ device_code, interval, expires_at }` 寫進 `DESK_KV` 的 `device:<polling_id>`，TTL 設 `expires_in`。
4. 回傳：

```
{
  "verification_uri_complete": "...",
  "user_code": "ABCD-1234",
  "polling_id": "...",
  "interval": 5,
  "expires_in": 600
}
```

`device_code` 本身不外洩給前端，前端只拿到不可逆向的 `polling_id`。

### `GET /api/auth/status?polling_id=...`

前端輪詢用。Worker stateless，每次呼叫都做一次嘗試：

1. 用 `polling_id` 查 `DESK_KV` 的 `device:<polling_id>`：
   - 不存在 → 回 `{ "state": "expired" }`。
2. 用該筆的 `device_code` 呼叫 WSPC `/auth/oauth/token`（device_code grant）：
   - 成功拿到 token → 建立 session（見下節「Session 建立」），把 token 寫進 `session:<新 id>`，設 `__Host-Session` cookie，刪掉 `device:<polling_id>`，回 `{ "state": "authenticated" }`。
   - WSPC 回 `authorization_pending` → 回 `{ "state": "pending" }`。
   - WSPC 回 `slow_down` → 回 `{ "state": "pending", "slow_down": true }`（前端把 interval 加倍）。
   - WSPC 回 `access_denied` 或 `expired_token` → 刪 `device:<polling_id>`，回對應 state（`"denied"` / `"expired"`）。

### `POST /api/auth/logout`

1. 從 cookie 取 session id。
2. 刪除 `DESK_KV` 的 `session:<id>`。
3. 回 `Set-Cookie: __Host-Session=; Max-Age=0` 把 cookie 清掉。
4. 回 `204`。

### `GET /api/me`

過 session 中間件（見下節），拿到有效的 access_token 後：

1. 呼叫 WSPC `GET /auth/me` 帶 `Authorization: Bearer <access_token>`。
2. 把 WSPC 回傳的 `{ user_id, email, display_name }` 直接回給前端。

如果 WSPC 回 401（理論上中間件會先處理，但保險起見），回 `{ "error": "session_invalid" }` + 清 cookie。

## Session 中間件流程

所有需要 WSPC 授權的 endpoint（本片就 `/api/me`，2b 起的 `/api/todo/*` 都走這個）都先過中間件。

### 流程

1. 讀 `__Host-Session` cookie。
   - 沒有 → `401`。
2. 用 cookie 值（session id）查 `DESK_KV` 的 `session:<id>`。
   - 不存在或解析失敗 → 清 cookie，`401`。
3. 檢查 `access_exp - now`：
   - 還有 30 秒以上 → 用現有 access_token，往下走。
   - 不足 30 秒 → 進「Refresh 流程」。
4. 把 access_token 交給 handler 使用。

### Refresh 流程

1. 呼叫 WSPC `/auth/oauth/token` 帶 refresh_token grant。
2. 成功：
   - 計算新 `access_exp = now + expires_in - 5`（留 5 秒誤差）。
   - 把新的 `{ access_token, refresh_token, access_exp }` 寫回 `session:<id>`（覆寫，TTL 不變）。
   - **Refresh token 每次使用會 rotate**，必須把新的存進 KV，不能保留舊的。
   - 繼續走 handler。
3. 失敗（403 / 400 / refresh_token 過期）：
   - 刪 `session:<id>`，清 cookie，回 `401`。

### 反應式 vs 預先 refresh

採反應式：在中間件偵測到 `access_exp` 不夠時才 refresh。沒做「access_token 剩 N 分鐘就背景預先 refresh」這種優化 —— 個人 app 每天 API 呼叫次數低，預先 refresh 反而會打更多 WSPC token endpoint。

### 失敗情境

| 狀況 | 中間件行為 |
|---|---|
| Cookie 不存在 | `401` |
| Cookie 存在但 KV 查不到（session 被刪 / 過期） | 清 cookie，`401` |
| Refresh 成功 | 更新 KV，繼續 |
| Refresh 失敗 | 刪 session，清 cookie，`401` |
| WSPC `/auth/me` 突然 401（理論上不會） | 強制 refresh 一次；若還是 401，刪 session 清 cookie，`401` |

## Device Flow Polling

前端不直接拿 `device_code`，全程靠 `polling_id` 跟 Worker 對話。

### 前端流程

1. 使用者按「登入 WSPC」按鈕 → 前端 `POST /api/auth/login`。
2. 拿到 `verification_uri_complete`、`user_code`、`polling_id`、`interval`、`expires_in`。
3. 開新分頁到 `verification_uri_complete`（讓使用者在 WSPC 完成授權）。
4. 同時在當前頁面顯示 user_code 與「等待中」狀態。
5. 每 `interval` 秒對 `/api/auth/status?polling_id=...` 發 request：
   - `pending` → 繼續輪詢。
   - `pending` + `slow_down: true` → 把 interval 加倍後繼續。
   - `authenticated` → 停止輪詢，重新整理頁面（cookie 已設好，後續 `/api/me` 可直接呼叫）。
   - `denied` / `expired` / `expired_token` → 停止輪詢，顯示錯誤訊息與「重試」按鈕。
6. 超過 `expires_in` 仍沒成功 → 停止輪詢，視為過期。

### 為什麼用 KV 而不是簽 polling_id

替代方案是把 `device_code` 用 HMAC 簽進 opaque `polling_id` 給前端，Worker 解開驗章就好，不用 KV。本片選 KV 因為：

- 整片已經因為 session 用了 KV，多寫一類 key 沒有額外的 setup 成本。
- KV 路線可以直接用 `polling_id` 查存在性來判斷有效，不用實作 HMAC 工具。
- TTL 由 KV 處理過期，不用自己驗 `expires_at`。

## 前端最小範圍

Slice 2a 在前端只動三個地方，Today / Plan / Backlog 的資料流完全不碰。

### 新增 `/login` 路由

顯示：

- user_code（大字、易讀）
- 「我已經完成 WSPC 授權」這類引導文字
- 「在 WSPC 開啟授權頁」按鈕（連到 `verification_uri_complete`）
- 「等待中…」或錯誤訊息（依 polling 狀態）

`/login` route 在掛載時自動 `POST /api/auth/login`，啟動 polling loop。輪詢期間 component 持續顯示狀態；`authenticated` 後導回 `/today`（或 query string 指定的回返路徑）。

### Header 顯示登入狀態

Today / Plan 頁面共用的 header 加上：

- **未登入**：顯示「登入 WSPC」按鈕 → 連到 `/login`。
- **已登入**：顯示 display_name（或 email fallback） + 「登出」選單項。

登入狀態怎麼判斷：

- App 啟動時呼叫 `GET /api/me`，成功就把 `{ user_id, email, display_name }` 存進 Zustand `useAuthStore`。
- 401 表示未登入，store 維持 `null`。
- 「登出」按鈕呼叫 `POST /api/auth/logout` 後清 store、導回 `/today`。

### Zustand store 變動

新增 `useAuthStore`：

```
{
  me: { user_id, email, display_name } | null,
  status: "loading" | "authenticated" | "unauthenticated",
  setMe(me),
  clear(),
}
```

不 persist（每次重新整理都重新呼叫 `/api/me` 驗證 cookie 仍有效）。

### 不動的部分

- `useTasksStore`、Today / Plan / Backlog 三個 mode 的所有資料流
- localStorage 仍是唯一的 task 資料源
- 「+ 加一件今天的事」、勾選、編輯、刪除這些互動仍寫 localStorage

## 安全考量

### Cookie 屬性

```
Set-Cookie: __Host-Session=<base64url-256bit-random>;
            HttpOnly;
            Secure;
            SameSite=Strict;
            Path=/;
            Max-Age=2592000
```

- `__Host-` prefix 強制 `Secure` + `Path=/` + 不可有 `Domain`，杜絕子網域 / 不安全頁面寫入同名 cookie 的攻擊。
- `HttpOnly`：JavaScript 完全讀不到，XSS 拿不走 session id。
- `SameSite=Strict`：跨站 request 不會帶這個 cookie，順帶處理掉 CSRF。
- `Max-Age=2592000`（30 天）：跟 KV TTL 對齊；超過就被視為過期 session，使用者重登。

### CSRF

`SameSite=Strict` 已涵蓋。所有改變 server 狀態的端點都是 `POST`（`/api/auth/login`、`/api/auth/logout`），瀏覽器不會從第三方 origin 帶 cookie 過來。`/api/me` 雖是 `GET`，但只讀、不改狀態，沒有 CSRF 面。

### Session id 不可預測

`crypto.getRandomValues(new Uint8Array(32))` 產 256-bit 隨機值，base64url 編碼後當 cookie 值。`polling_id` 同方式生成。

### Logout 的真實性

刪 `session:<id>` 之後，原 cookie 就算被攻擊者拿走也對應到不存在的 KV key，中間件直接 401。比起無 KV 方案「只能清 client cookie、token 還在攻擊者手上到 refresh 過期」，這點有優勢。

### Token 不外露給前端

`access_token` 與 `refresh_token` 全程只在 Worker 與 KV 之間流動，前端 JavaScript 永遠看不到。即使前端被 XSS 攻擊，攻擊者拿不到 WSPC token，最多能做的就是透過 BFF 打 `/api/*`（仍受 SameSite 與同源限制）。

## 測試策略

### 單元測試（Vitest）

- **Session 中間件**：
  - Cookie 不存在 → 401
  - Cookie 存在 + KV 有 session + access_exp 未過 → 進 handler
  - Cookie 存在 + KV 有 session + access_exp 即將過期 → 觸發 refresh、寫回 KV、進 handler
  - Refresh 失敗 → 刪 session、清 cookie、401
  - Cookie 存在 + KV 無 session → 清 cookie、401
- **Device flow state machine**：
  - WSPC 回 `authorization_pending` → 中間結果 `pending`
  - WSPC 回 `slow_down` → 結果 `pending` + `slow_down: true`
  - WSPC 回 token → 建 session + set cookie + 刪 `device:<id>`
  - WSPC 回 `access_denied` → 刪 `device:<id>` + 回 `denied`
- **KV 操作**：lazy 註冊 client_id 的存在性檢查、session TTL 設定。

WSPC 呼叫用 `fetch` mock 攔截（如 `vi.spyOn(globalThis, "fetch")`）。KV 用 Miniflare 提供的 mock binding。

### 整合測試（Miniflare）

跑完整的 Worker，模擬 WSPC 回應：

- 完整 login 鏈：`POST /api/auth/login` → `GET /api/auth/status` 多次 pending → 最後 authenticated → 確認 cookie 寫入 + session 在 KV。
- `GET /api/me`：帶有效 cookie → mock WSPC `/auth/me` → 確認回傳 passthrough。
- `POST /api/auth/logout`：確認 KV session 被刪、cookie 被清。

### E2E（Playwright）

- 開啟 `/today` → 看到「登入 WSPC」按鈕。
- 點按鈕進 `/login` → 看到 user_code 與 verification 連結。
- Polling 狀態能正確顯示（mock 後端回應 authenticated 立刻轉跳）。
- 已登入狀態下 header 顯示 display_name。
- 點登出後回到「登入 WSPC」狀態。

真實的 WSPC consent 需要互動，e2e 不跑完整 device flow，只測前端對 `/api/auth/*` 回應的反應。

### 部署後手動驗證

部署到 production 後跑一次完整：

1. 在無痕視窗開 `https://desk.yurenju.me`。
2. 按登入 → 開分頁完成 WSPC 授權 → 回到 desk 看到自己的 email。
3. 等 20 分鐘（access token 過期）→ 重整 → 應仍然登入（refresh 中間件動作）。
4. 按登出 → 確認 cookie 被清、`/api/me` 回 401。
5. 用 `wrangler kv key list` 確認 `session:<id>` 真的被刪除。

## 不做（明確）

- 任何 `/api/todo` 端點：留給 Slice 2b。
- WSPC `DeskTask` custom type 註冊、custom fields 配置：留給 2b。
- 前端任何 todo 資料源切換（Today / Plan / Backlog 仍 localStorage）：留給 2b。
- WSPC token revoke：WSPC 沒提供端點，logout 只刪本地 session。
- Owner allowlist / 鎖定 yurenju 才能登入：multi-tenant，任何人可用自己的 WSPC 帳號登入看自己的資料。
- CSRF token：`SameSite=Strict` + `__Host-` 已覆蓋。
- Server 側 session 列表 / 撤銷管理介面：個人 app 不需要。
- 預先 refresh（access token 還沒過期就背景更新）：反應式即可。

## 驗收標準

部署到 production 後，下列場景全部通過視為 Slice 2a 完成：

1. 從 `https://desk.yurenju.me` 走完整 device flow 可成功登入。
2. 登入後 header 顯示自己的 WSPC `display_name`（或 email）。
3. 重新整理頁面後仍維持登入狀態（`/api/me` 仍能拿到資料）。
4. 等待 20 分鐘以上後（access token 已過期）操作仍正常，KV `session:<id>` 的 `access_token` 確實被更新。
5. 登出後 header 回到「登入 WSPC」狀態，KV 對應 session 被刪除。
6. 從第二個瀏覽器登入不影響第一個瀏覽器的 session。
7. 後端單元測試與整合測試全綠（中間件、device flow state machine、KV 操作）。
8. Today / Plan / Backlog 三個 mode 的互動跟 Slice 1 一模一樣（沒有 regression）。

## OpenAPI 型別產生

採用「snapshot + 顯式 sync」模式，跟 wspc-cli 一致：

- `spec/wspc-openapi.json` 是 WSPC OpenAPI 的本機快照，commit 進 repo
- `scripts/sync-wspc-spec.ts`：拉 `https://api.wspc.ai/openapi.json` 覆寫 `spec/wspc-openapi.json`，由開發者顯式跑（不在 build 流程裡）
- `worker/wspc-types.ts`：由 `openapi-typescript` 從 `spec/wspc-openapi.json` 產生的純型別檔，commit 進 repo
- `worker/wspc.ts`：手寫的 fetch 呼叫，從 `worker/wspc-types.ts` 取 request / response 型別

只用 `openapi-typescript`（產純型別），不引入 runtime client library。理由：

- WSPC 的 OAuth error response（`authorization_pending` 等）OpenAPI 沒 model，狀態機邏輯一定要手寫，runtime client 在 auth 部分幫不上忙
- 純型別 runtime bundle 影響 0 byte
- 想換成 `openapi-fetch` / `@hey-api/openapi-ts` 未來再升級，現在不預先 invest

兩個 npm script：

- `npm run wspc:sync`：跑 `scripts/sync-wspc-spec.ts`，更新 `spec/wspc-openapi.json`
- `npm run wspc:generate`：跑 `openapi-typescript spec/wspc-openapi.json -o worker/wspc-types.ts`

兩個分開、不串成一個，讓開發者顯式決定何時去打 wspc.ai。

## Setup 步驟（給未來部署參考）

僅需一次性 setup：

```
# 建立 KV namespace
wrangler kv namespace create DESK_KV
# 把回傳的 id 填進 wrangler.jsonc 的 kv_namespaces

# 拉 WSPC OpenAPI snapshot + 產 TypeScript 型別
npm run wspc:sync
npm run wspc:generate

# 部署
npm run deploy
```

後續部署只需 `npm run deploy`。WSPC OpenAPI 改版時跑 `npm run wspc:sync && npm run wspc:generate` 重新產型別，TypeScript compile 會抓出 breaking change。Worker 第一次處理 `/api/auth/login` 時會 lazy 註冊 WSPC client 並把 `client_id` 寫進 KV，不需要手動 register。
