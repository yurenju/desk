# Desk.yurenju.me - 系統設計規格書

本文件定義 `desk.yurenju.me` 個人儀表板專案的系統架構、驗證流程與工作流資料對應設計。

## 專案目標與定位
本專案為個人專屬（yurenju）的生產力儀表板，串接 WSPC (https://wspc.ai) 做為後端服務。專案以階段式開發：第一階段聚焦於 Todo 與工作流程管理，後續階段將擴充 Calendar 與 Mail。

## 系統架構
專案使用單一 Repository (Monorepo) 管理前端 React 與後端 Cloudflare Worker，採用以下架構：
1. **託管與部署**：使用 Wrangler Workers with Assets。`wrangler.toml` 設定 `assets = { directory = "./dist" }`，前端 React 的打包成品與後端 Worker 部署在同一個網域下，無 CORS 問題。
2. **BFF 模式 (Backend-for-Frontend)**：Cloudflare Worker 作為 API 代理人與驗證管理器。
3. **儲存媒介**：使用 Cloudflare KV，僅用於儲存 OAuth Client 註冊資訊與 Owner Session，不存放任何應用程式狀態。

## 驗證流程 (OAuth 2.1 Device Flow via BFF)
為確保安全性，Token 不儲存於瀏覽器 localStorage，而是透過 BFF 管理。
1. **初次啟動**：Worker 檢查 KV 中有無 `wspc:client_id`。若無，向 WSPC 註冊新 Client，並將 `client_id` 快取於 KV。
2. **登入流程**：
   - 使用者點擊「登入 WSPC」-> 前端對 Worker `/api/auth/login` 發送請求。
   - Worker 向 WSPC `/auth/oauth/device` 發送請求，取得 `device_code` 與 `verification_uri_complete`。
   - Worker 回傳該認證網址給前端，並在背景以 `device_code` 輪詢 WSPC `/auth/oauth/token`（或透過前端輪詢 `/api/auth/status` 觸發 Worker 查詢）。
3. **Session 綁定**：
   - 認證成功後，Worker 取得 `access_token` 與 `refresh_token`。
   - Worker 將這些資訊加密，寫入名為 `__Host-Session` 的安全 Cookie (HttpOnly, Secure, SameSite=Strict, Path=/).
   - 同時在 KV 寫入 `session:owner` 作為有效登入狀態對照。
4. **API 代理**：
   - 前端發送所有 Todo 請求至 `/api/todo/*`。
   - Worker 攔截請求，從 Cookie 解密 Token，代入 WSPC API headers；若 Access Token 過期，Worker 自動使用 Refresh Token 向 WSPC 更新，並重寫 Cookie。

## 個人工作流與 WSPC 資料對應
本系統核心特色是高度契合使用者的月、週、日三層對齊工作流。所有狀態儲存完全依賴 WSPC 核心屬性與自訂欄位 (Custom Fields)。

我們將在 WSPC 註冊一個名為 `DeskTask` 的自訂任務型態：

### 1. WSPC 自訂欄位配置 (DeskTask)
| 欄位名稱 (Key) | 欄位型別 | 說明與可能的值 |
| :--- | :--- | :--- |
| `plan_month` | `string` | 本任務規劃的月份，格式為 `YYYY-MM` (例如 `"2026-05"`) |
| `monthly_priority` | `string` | 月度優先級：`"top_3"` (本月最重要三件事) 或 `"other"` (其他規劃內任務) |
| `is_unplanned` | `string` | 是否為規劃外任務：`"true"` (月中新增的插單) 或 `"false"` |
| `daily_priority` | `string` | 每日優先級：`"top_3"` (今日最重要三件事) 或 `"other"` |

### 2. 核心屬性對應
- **週/日排程**：直接使用 WSPC 內建的 `due_at` 欄位（格式為 `YYYY-MM-DD`）。在週規劃視圖中將月規劃任務分配到某天，即是將 `due_at` 更新為該天日期。
- **任務狀態**：使用 WSPC 內建 `status` 欄位 (`"open" | "in_progress" | "done" | "cancelled"`).

---
## 驗證與測試計畫
1. **認證測試**：手動驗證 Device Flow 登入、Cookie 寫入、自動 Token 刷新與登出。
2. **API 代理與隔離**：確保非 Owner 請求無法讀取任何 API。
3. **工作流驗證**：測試 WSPC `DeskTask` 自訂欄位讀寫、過濾（如 `cf.plan_month=2026-05`）與狀態變更。
