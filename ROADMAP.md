# desk.yurenju.me - 專案路線圖 (Roadmap)

這個專案是 `desk.yurenju.me` 個人儀表板（整合 Mail、Calendar、Todo），運行於 Cloudflare Workers (using Wrangler Assets)，後端使用 WSPC (https://wspc.ai) 服務。

專案優先實作 **Todo 與個人工作流**，其後依序擴充 **Calendar** 與 **Mail**。

---

## 🚀 第一階段：基礎建設與 Todo 個人工作流（目前重點）

第一階段的目標是建立專案的骨架、安全驗證機制，並完成完全契合個人月/週/日對齊邏輯的 Todo 功能。

### 1. 專案初始化與環境設定 (Infrastructure)
- [ ] **專案初始化**：建立 React (Vite + TS) 與 Wrangler Assets Monorepo。
- [ ] **UI 基礎**：安裝 [Base UI](https://base-ui.com) (`@base-ui/react`) 作為 primitives，搭配 **CSS Modules + CSS Custom Properties**。**不使用 Tailwind、不使用 shadcn**（理由詳見 [HANDOFF.md](docs/claude-design/design_handoff_desk/HANDOFF.md) §2）。Design tokens 依 HANDOFF §4 寫入 `src/tokens/*.css`。
- [ ] **Cloudflare 資源配置**：建立本地開發與線上部署所屬的 Cloudflare KV 命名空間，編寫 `wrangler.toml`。

### 2. BFF 代理與 WSPC 認證機制 (Auth & BFF)
- [ ] **動態 Client 註冊**：實作 Worker 啟動時自動向 WSPC 註冊 Client 並保存 `client_id` 至 KV。
- [ ] **BFF 認證路由**：
  - `/api/auth/login`：啟動 Device Flow 並回傳認證 URL。
  - `/api/auth/status`：輪詢認證結果，成功後寫入加密 HttpOnly Cookie。
  - `/api/auth/logout`：清理 Session。
- [ ] **Token 自動刷新**：實作 API 代理中間件，在 Token 過期時自動調用 WSPC Refresh Grant 並重新寫入 Cookie。
- [ ] **API 安全防護**：限制僅有持有有效 Session Cookie 的 Owner (yurenju) 才能存取 `/api/todo/*` API。

### 3. 資料模型 (Data Model)

採用 **三層漏斗** 模型，所有層級共用同一個 WSPC `DeskTask` 型態，差別只在 custom fields。**月與日兩層採對稱結構**（都用 `scheduled_*` array + `unscheduled_*` 標記目前歸屬）：

```
Backlog  (scheduled_months 空，或 last <= unscheduled_month)
   ↓ promote 進某個月（append 到 scheduled_months）
Monthly  (last(scheduled_months) > unscheduled_month，且 scheduled_dates 空或已 unscheduled)
   ↓ schedule 到某天（append 到 scheduled_dates）
Daily    (last(scheduled_dates) > unscheduled_at)
```

同一個 task 可以同時出現在月度欄與日欄（月度欄採 α 模式：顯示所有目前歸屬本月的 task，含已排到某天的）。

#### Custom Fields 清單

| Field | 型別 | 用途 |
|---|---|---|
| `scheduled_months` | string_array | 該 task **曾經被排到的月份**（`"YYYY-MM"`）；**永不 remove**，移月 = append。陣列長度 = 跨月拖延次數 |
| `scheduled_dates` | string_array | 該 task **曾經被排定的日期**（`"YYYY-MM-DD"`）；同樣 append-only。陣列長度 = 跨日拖延次數 |
| `unscheduled_month` | string | 最後一次「從月度移走 / 丟回 backlog」的月份（`"YYYY-MM"`） |
| `unscheduled_at` | string | 最後一次按「略過 / 從某天移走」的日期（`"YYYY-MM-DD"`） |
| `monthly_priority` | string | `"1"` / `"2"` / `"3"`，該月最重要三件事的順序 |
| `daily_priority` | string | `"1"` / `"2"` / `"3"`，當日最重要三件事的順序 |
| `is_adhoc` | string | `"true"` / `"false"`，task 進清單時是否為臨時插單 |
| `done_on` | string | 完成時的 ISO 時間；前端 PATCH `status: "done"` 時同步寫入 |
| `position` | string | （v1.1+）同欄拖曳排序用，lex-order 字串 |

**不使用 WSPC 核心 `due_at`** —— task 排定日期完全用 `scheduled_dates` 表達。

**WSPC `status` enum** 為 `open / in_progress / done / cancelled`；下文「未完成」均指 `status ∈ {open, in_progress}`。

#### 關鍵語意

- **「主要位置 (primary)」推導規則**（前端純粹計算）：
  ```
  primaryMonth = last(scheduled_months) if last > unscheduled_month else null（在 backlog）
  primaryDate  = last(scheduled_dates)  if last > unscheduled_at    else null（未排到任何日）
  ```

- **軌跡顯示規則**：每個 view（某天 / 某月）顯示**所有** `scheduled_*` 內含該日/該月的 task，並依該 entry 是否為 `last` 區分樣式：

  | 樣式 | 條件 | 互動 |
  |---|---|---|
  | **primary（一般 row）** | 該日 == `primaryDate`（或月份 == `primaryMonth`） | 完整互動（編輯、略過、刪除、勾選） |
  | **順延軌跡** | 該日在 array 內，但 `last` 比它新 → 已順延到後面 | 唯讀；可勾選完成（同一 entity） |
  | **略過軌跡** | 該日 == `last` AND `last == unscheduled_at` → 在這天被略過 | 唯讀；可勾選完成 |

  完成後（`status = "done"`）：`done_on` 之前的軌跡仍顯示為順延樣式，`done_on` 那天顯示為「✓ 完成」。
  月份軌跡規則完全對稱（把「日」換成「月」）。

- **略過 (Dismiss) — 日層級**：`unscheduled_at = today`，不動 `scheduled_months`。原本目前月有歸屬的回月度欄，沒有的回 backlog。

- **丟回 Backlog — 月層級**：`unscheduled_month = last(scheduled_months)`（同時 `unscheduled_at = today` 確保 daily 也清掉）。

- **移到下個月**：`scheduled_months.push(next_month)`，因為 `last` 更新會自動讓「目前月」推進，舊月份留在 history。

- **Carryover 判定**（前端 client-side filter）：

  | 類型 | 條件（皆需 `status` 未完成） |
  |---|---|
  | 日 carryover | `scheduled_dates.length > 0` AND `last(scheduled_dates) < today` AND `last(scheduled_dates) > (unscheduled_at ?? "")` |
  | 月 carryover | `scheduled_months.length > 0` AND `last(scheduled_months) < current_month` AND `last(scheduled_months) > (unscheduled_month ?? "")` AND 沒有 today 在 `scheduled_dates` |

- **`is_adhoc` 染色規則**：
  - 月度欄：`is_adhoc = true` → 紅 chip（提醒月中膨脹）
  - 日欄：`is_adhoc = true` AND `created_at` 是 today AND `scheduled_dates` 只有 today → 紅 chip（提醒當日插單）

- **加入點預設值**：

  | 加入點 | scheduled_months | scheduled_dates | is_adhoc |
  |---|---|---|---|
  | Backlog + | `[]` | `[]` | `false` |
  | Monthly + | `[本月]` | `[]` | 使用者 toggle，預設 `false`（月初規劃）/ `true`（月中追加） |
  | Today + | `[]` | `[today]` | `true` |
  | Backlog → 拉到 Monthly | append 本月 | (維持) | `false` |
  | Backlog/Monthly → 拉到 Today | (維持/append 本月) | append today | `false` |

### 4. 個人工作流面板 (Frontend Todo Flow)
依據「Backlog ➔ 月度規劃 ➔ 週度分派 ➔ 每日焦點」工作流，實作以下 UI 與 WSPC API 串接：
- [ ] **WSPC 自訂型態初始化**：於 Worker 啟動時或首次登入後，自動在 WSPC 註冊 `DeskTask` 自訂任務型態，並建立上節列出的 custom fields。
- [ ] **Backlog 區（Monthly 欄上方摺疊區）**：
  - 預設摺疊，顯示「📥 Backlog (N)」標頭。
  - 展開後可拖曳 task 到月度欄（promote 進本月）或日欄（直接 schedule）。
  - 提供 + 按鈕快速新增 backlog task。
- [ ] **月規劃看板 (Monthly Column)**：
  - 支援月份篩選；月度欄顯示 primary 在本月的 task（α 模式，含已排到某天的）+ 過去曾排在本月的軌跡 task。
  - 過濾：`cf.scheduled_months contains 本月`；前端再分流 primary（`last > unscheduled_month`）vs 軌跡（含本月但非 last）。
  - 區分並呈現「本月最重要三件事」（`monthly_priority` = 1/2/3）及「其他規劃內任務」。
  - 提供規劃期後的任務新增功能，並依使用者 toggle 標記 `is_adhoc`。
- [ ] **週規劃看板 (Weekly Column)**：
  - 顯示週一至週日任務列表。
  - 支援將 backlog / 月度任務拖曳或指派至特定日期（append 到 `scheduled_dates`）。
- [ ] **今日焦點 (Daily Focus Column)**：
  - 當天日期置頂；過濾：`cf.scheduled_dates contains today`；前端再分流 primary（`last > unscheduled_at`）vs 軌跡（含 today 但非 last）。
  - 特別醒目顯示 `daily_priority` = 1/2/3 的今日最重要三件事。
  - 提供完成任務（PATCH `status: "done"` 並寫入 `done_on`）及重新開啟的狀態切換。
- [ ] **日 Carryover banner**：新一天打開時，依上節「日 carryover」判定列出未完成 task，提供「→ 三件事 / → 計劃內 / 略過」三個動作。
- [ ] **月 Carryover banner**：新一月打開時，依上節「月 carryover」判定列出未完成 task，提供「→ 本月最重要三件事 / → 本月其他任務 / 丟回 backlog」三個動作（即月底 review 入口）。
- [ ] **月底 Review**：月底提供審核介面，逐筆處理本月未完成 task（丟回 backlog 或移到下月，皆為手動，不自動）。

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
