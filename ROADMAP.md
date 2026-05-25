# desk.yurenju.me - 專案路線圖 (Roadmap)

這個專案是 `desk.yurenju.me` 個人儀表板（整合 Mail、Calendar、Todo），運行於 Cloudflare Workers (using Wrangler Assets)，後端使用 WSPC (https://wspc.ai) 服務。

專案優先實作 **Todo 與個人工作流**，其後依序擴充 **Calendar** 與 **Mail**。

---

## 🚀 第一階段：基礎建設與 Todo 個人工作流（目前重點）

第一階段的目標是建立專案的骨架、安全驗證機制，並完成完全契合個人月/週/日對齊邏輯的 Todo 功能。

### 1. 專案初始化與環境設定 (Infrastructure)
- [ ] **專案初始化**：建立 React (Vite + TS) 與 Wrangler Assets Monorepo。
- [ ] **UI 基礎**：配置 Tailwind CSS、安裝 shadcn 及其背後的 Base UI 依賴，完成基礎排版。
- [ ] **Cloudflare 資源配置**：建立本地開發與線上部署所屬的 Cloudflare KV 命名空間，編寫 `wrangler.toml`。

### 2. BFF 代理與 WSPC 認證機制 (Auth & BFF)
- [ ] **動態 Client 註冊**：實作 Worker 啟動時自動向 WSPC 註冊 Client 並保存 `client_id` 至 KV。
- [ ] **BFF 認證路由**：
  - `/api/auth/login`：啟動 Device Flow 並回傳認證 URL。
  - `/api/auth/status`：輪詢認證結果，成功後寫入加密 HttpOnly Cookie。
  - `/api/auth/logout`：清理 Session。
- [ ] **Token 自動刷新**：實作 API 代理中間件，在 Token 過期時自動調用 WSPC Refresh Grant 並重新寫入 Cookie。
- [ ] **API 安全防護**：限制僅有持有有效 Session Cookie 的 Owner (yurenju) 才能存取 `/api/todo/*` API。

### 3. 個人工作流面板 (Frontend Todo Flow)
依據「月度規劃 ➔ 週度分派 ➔ 每日焦點」工作流，實作以下 UI 與 WSPC API 串接：
- [ ] **WSPC 自訂型態初始化**：於 Worker 啟動時或首次登入後，自動在 WSPC 註冊 `DeskTask` 自訂任務型態與欄位（`plan_month`, `monthly_priority`, `is_unplanned`, `daily_priority`）。
- [ ] **月規劃看板 (Monthly Column)**：
  - 支援月份篩選與顯示。
  - 區分並呈現「本月最重要三件事」及「其他規劃內任務」。
  - 提供規劃期後的任務新增功能，並自動標記 `is_unplanned: "true"` (插單/非規劃內)。
- [ ] **週規劃看板 (Weekly Column)**：
  - 顯示週一至週日任務列表。
  - 支援將月規劃看板的任務拖曳或指派至特定日期（藉由修改 WSPC 任務的 `due_at` 欄位）。
- [ ] **今日焦點 (Daily Focus Column)**：
  - 當天日期置頂。
  - 根據當天日期（`due_at`）過濾任務，並特別醒目顯示 `daily_priority: "top_3"` 的今日最重要三件事。
  - 提供完成任務（PATCH `status: "done"`）及重新開啟的狀態切換。

---

## 📅 第二階段：Calendar 整合（後續擴充）

結合 WSPC Calendar API，將行事曆融入個人儀表板中。

- [ ] **BFF API Key 代理**：由於 Calendar API 目前僅支援 API Key，將 API Key 加密存放於 Cloudflare KV/變數，由 Worker 代理所有 Calendar 請求，確保 API Key 不外洩給瀏覽器。
- [ ] **行事曆視覺化**：於 Dashboard 中提供月曆 (Month View) 與日曆檢視 (Schedule View)。
- [ ] **任務與行事曆整合**：允許將 due_at 的待辦事項直接投射在行事曆上，或在行事曆上直接新增待辦事項。

---

## ✉️ 第三階段：Mail 整合（後續擴充）

整合 WSPC Email API，讓儀表板成為完整的個人控制台 (Desk)。

- [ ] **郵件收發介面**：實作收件匣 (Inbox)、寄件匣與寫信視窗，支援 WSPC `@wspc.app` 郵件收發。
- [ ] **別名 (Alias) 管理**：支援 WSPC API 中的 alias 設定與寄件者別名選擇。
- [ ] **郵件轉任務功能**：實作一鍵功能，可將重要信件轉換為 WSPC Todo 項目（填入 `DeskTask` 型態並指派 `plan_month`），建立完整的生產力閉環。
