# Todo 讀取 SWR 快取 + 同步狀態指示

## 背景與動機

在 Sentry 埋了 performance tracing 後，讀取路徑的實測顯示延遲幾乎 100% 來自 wspc API 往返，BFF 本身是純 proxy、自身耗時可忽略：

| 請求 | 實測 | 組成 |
|------|------|------|
| `GET /api/todo` | 1.5s（穩態）/ 4.6s（首次 bootstrap 或 schema reconcile） | `ensureBootstrap`（命中 KV 很快）+ `listTodos`（wspc 1.5–2s） |
| `GET /api/me` | 2.9s | wspc `/me` 一趟，碰到 token 過期再 +1.5s refresh |

已排除的方向：

- `/me` 與 `/todo` 已是並行（各自 mount effect 幾乎同時發），牆鐘 ≈ max，並行化沒得再省。
- bootstrap 已 KV 快取，穩態不打 wspc；token 也是「快過期才 refresh」。
- 寫入已全面樂觀更新（先改畫面、背景 `enqueuePatch`、失敗 rollback），互動不卡。
- 後端快取 todo list：單人、樂觀寫入架構下，寫後 cache 立即 stale、又要處理 invalidation，一致性風險大於收益，先不做。

真正的痛點是**冷開白畫面 2–4.6s**：`useTasksStore` 的 `tasks` 每次從空陣列開始，`reload` 回來前沒東西可畫。

## 目標

1. 消除冷開白畫面：重開頁面時立即顯示上次的 tasks，背景 revalidate 後悄悄換新（stale-while-revalidate）。
2. 背景 revalidate 失敗但有快取時，靜默守著舊資料，並在 TopNav 顯示輕量「未同步」徽章。

## 非目標

- 完整 PWA（service worker、離線快取整個 app shell、可安裝）—— 之後想做再獨立開 spec。
- 後端（KV / Cache API）快取 todo list。
- 動寫入路徑（樂觀更新現況不改）。

## 設計

### 1. 持久化範圍

用 zustand 的 `persist` middleware 包 `useTasksStore`，`partialize` **只存 `tasks` 一個欄位**。`status` / `today` / `error` / `recentlyDeleted` 都不持久化：

- `status` 不存 → 冷開維持 `idle`，`loadTasks` 照樣觸發背景 reload（不會被 load-once guard 跳過）。這是最關鍵的一點：若把 `status: "ready"` 也存下來，`loadTasks` 會 skip reload，快取永遠不更新。
- `today` 不存 → 冷開用 `todayISO()` 取當下，自動處理換日；快取的舊 tasks 靠 `layer()` 用當下 `today` 重算分層，不會排錯格。
- 登出：`clear()` 順手清掉 persist 的 key（單人自用，不做 per-userId 分帳快取；清掉即可避免不同帳號共用瀏覽器時閃到前一個帳號的資料）。

### 2. 拆開「有資料可畫」與「正在抓」

目前兩個 view 都是 `if (status === "loading" || status === "idle") return <LoadSkeleton />`（`src/routes/plan.tsx`、`src/routes/focus.tsx`）。背景 reload 時 `status` 會變 `loading`，就會把快取的 tasks 蓋成骨架屏，SWR 因此破功。

改成以「有沒有 tasks」為準：

- 只有**冷開且真的沒快取**（`tasks.length === 0` 且 `status` 仍為 loading/idle）才顯示 `LoadSkeleton`。
- 有快取就直接畫 tasks，背景 reload 進行中也不轉圈。

### 3. 同步狀態指示（同步結果驅動）

在 store 加一個 `synced: boolean` 欄位（初值 `true`），由同步結果驅動：

- 背景 reload **失敗但有快取**（`tasks.length > 0`）→ 不進 `status: "error"`（那會蓋掉畫面），改成保留現有畫面 + `synced = false`。
- 任一 reload **成功** → `synced = true`。
- 冷開**無快取**時 reload 失敗 → 維持現況 `status: "error"` 全屏錯誤（沒東西可守）。

TopNav 顯示一個「未同步」小徽章，只在 `synced === false` 時出現，下次同步成功即消失。徽章純反映「畫面資料是否跟 server 同步」，涵蓋斷線、wspc 掛、5xx 等所有「資料不是最新」情況。

寫入失敗路徑不動：現況本來就會 rollback + `error: "save_failed"`，那條路維持原樣。

### 4. 狀態與行為對照

| 情境 | 行為 |
|------|------|
| 冷開有快取，reload 成功 | 秒畫舊的 → 悄悄換新 |
| 冷開有快取，reload 失敗 | 守著舊的 + 「未同步」徽章（`synced = false`） |
| 冷開無快取，reload 失敗 | 全屏 `error`（同現況） |
| 樂觀寫入失敗 | rollback + `save_failed`（同現況，不動） |

### 5. 受影響檔案

| 檔案 | 變更 |
|------|------|
| `src/store/tasks.ts` | 包 `persist`（partialize 只留 `tasks`）；加 `synced` 欄位；`reload` 失敗分支依有無快取決定 `synced=false` 或 `status="error"`；`reload` 成功設 `synced=true` |
| `src/store/auth.ts` | `clear()` 清掉 persist 的 localStorage key |
| `src/routes/plan.tsx`、`src/routes/focus.tsx` | gating 改為「`tasks.length === 0` 才顯示骨架屏」 |
| `src/features/shell/TopNav.tsx` | `synced === false` 時顯示「未同步」徽章 |

## 測試策略

### 自動化測試（vitest / Testing Library）

- persist 只存 `tasks`：hydration 後 `status` 仍為 `idle`（不被持久化）。
- hydration 後 `loadTasks` 仍觸發 reload（load-once guard 沒被 persisted status 跳過）。
- `reload` 失敗**有快取**時 `synced = false` 且不進 `status: "error"`、tasks 保留。
- `reload` 失敗**無快取**時進 `status: "error"`。
- `reload` 成功時 `synced = true`。
- `clear()` 清掉 persist key。

### e2e（Playwright，對真實 BFF + mock WSPC）

- 因為動到讀取載入路徑，補一條：重開頁面時快取立即可見、不閃骨架屏。

### 手動測試（preview + AI agent）

- 由 AI agent 透過 `preview_start`（共用 profile，見 CLAUDE.md）開預覽。先探測登入狀態，已登入直接驗收，未登入才請使用者走 device flow。
- 逐項手動驗收：
  - 冷開（重整頁面）白畫面是否消失、上次 tasks 是否立即出現。
  - 背景 reload 完成後畫面是否無縫換成最新。
  - 模擬離線 / wspc 失敗時，畫面是否守住舊資料、TopNav「未同步」徽章是否出現，恢復後徽章是否消失。
  - 登出後重登（或換帳號）是否不會閃到前一份快取。

## 風險與注意事項

- **load-once guard 與 persisted status**：務必不 persist `status`，否則背景 revalidate 被跳過（設計第 1 節已載明）。
- **hydration 時序**：zustand `persist` 是同步從 localStorage 讀取（非 async storage），首次 render 前 `tasks` 即已 hydrate，不需處理 hydration flash；若日後改用 async storage 需重新檢視。
- **換日**：`today` 不持久化，冷開重取當下日期，`layer()` 以當下 `today` 重算，快取舊資料不會排錯格。
