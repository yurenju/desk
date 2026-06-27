# Yuren's Desk

個人儀表板，整合 **Todo / Calendar / Mail**。目前 v1 聚焦在 **Todo 與個人工作流**，跑在 Cloudflare Workers（Wrangler Assets），後端用 [WSPC](https://wspc.ai) 作為資料源（todo / calendar / email / auth）。

> 狀態：v1 的 Todo 工作流已實作到「可以實際每天用」的程度，先用一陣子再決定下一步要改什麼。Calendar / Mail 為後續階段。

## 核心概念：三層漏斗

Desk 把任務分成三層，**月與日對稱**，同一個 task 可同時出現在多層：

```
Backlog ──排到某月──▶ Monthly ──排到某天──▶ Daily
```

- **Backlog**：還沒決定哪個月做。
- **Monthly（本月）**：歸屬某個月，可挑「整月三件事」。
- **Daily（某天 / Focus）**：排到某一天執行，可挑「當天三件事」。

兩個主畫面是**同一份資料的兩種鏡頭**：

- **Plan（規劃）**：月 / 週 / 日三欄並列，繞單一「焦點日」耦合。每週開始時把大範圍工作往下排到某幾天。支援拖曳重排。
- **Focus（專注）**：把某一天放大成 hero、月 / 週降權為輔助。每天執行時鎖定焦點、不被遠期任務分心。

所有排程語意（排到本月、排到某天、三件事名次、計畫內 / 外、拖延軌跡）都用 WSPC todo 的 **custom fields** 表達，append-only 保留軌跡。完整欄位語意見 [docs/wspc-mcp-operations.md](docs/wspc-mcp-operations.md)。

## 技術棧

- **前端**：React 18 + TypeScript + Vite，TanStack Router，Zustand，[Base UI](https://base-ui.com)（`@base-ui/react`）+ CSS Modules + CSS Custom Properties，`@dnd-kit`（拖曳）。
- **後端（BFF）**：同一個 Cloudflare Worker（`worker/`）。WSPC device-flow 登入、`__Host-Session` cookie + KV session + token 自動刷新、`/api/todo` proxy 到 WSPC。
- **儲存**：Cloudflare KV（`DESK_KV`：auth session + per-user bootstrap）。

## 開發

```bash
npm install --legacy-peer-deps   # openapi-typescript 與 typescript 6 peer 衝突，必加
npm run dev                      # Vite dev（含 dev worker）
npm run build                    # tsc -b && vite build —— 也是型別檢查的唯一可信指令
npm test                         # vitest
npm run test:e2e                 # Playwright（對真實 BFF + mock WSPC）
npm run preview                  # wrangler dev
npm run deploy                   # vite build && wrangler deploy
```

**型別檢查只信 `npm run build`**。根 `tsconfig.json` 是 solution-style（`files: []` + `references`），`tsc -p … --noEmit` 對它是 no-op 假綠。

改到 **Today / Plan 互動、登入流程**後，除了 `vitest` 也要跑 `npm run test:e2e`（vitest 在 jsdom 抓不到 portal menu、focus、跨 section 移動、真實拖曳）。

## 給 AI agent：直接用 wspc MCP 操作 Desk 帳號

如果你是透過 **wspc MCP** 連到某個 Desk 帳號（而非走畫面），要讓寫入結果跟使用者在 UI 上操作一致，請照 [docs/wspc-mcp-operations.md](docs/wspc-mcp-operations.md) —— 那份文件講解每個 UI 動作（排到 backlog / 排到本月 / 排到今天 / 設三件事 / 計畫內外 / 丟回）對應哪些 custom field 怎麼寫，以及 append-only 軌跡、`*_ranks` 取代 legacy `*_priority` 等容易踩的雷。

## 目錄

- `src/` —— 前端。`src/lib/`（純函式：tasks 推導、date、ranks、order）、`src/store/`（Zustand + taskOps 寫入語意）、`src/features/`（Plan / Focus / 各欄）、`src/ui/`（primitives）。
- `worker/` —— BFF。auth middleware、`/api/todo` 路由、WSPC client、bootstrap（建 project + DeskTask type）、todo-mapper。
- `docs/` —— 設計文件（`superpowers/specs`、`superpowers/plans`）、設計交付（`claude-design`）、MCP 操作指南。
- `e2e/` —— Playwright。
