# desk.yurenju.me

個人儀表板（整合 Mail / Calendar / Todo），跑在 Cloudflare Workers，後端用 WSPC（https://wspc.ai）。開發策略與進度見 [ROADMAP.md](ROADMAP.md)：垂直切片，每片可 demo。

## 撰寫 spec 時

寫設計文件（`docs/superpowers/specs/**`）的「測試策略」時，除了自動化測試（vitest / Testing Library / e2e），**一律加入「手動測試（preview + AI agent）」一項**：

- 由 AI agent 透過 `preview_start` 開預覽，實際操作畫面驗證視覺與互動 —— 那些難用單元測試涵蓋的觀感、過場、觸控目標、響應式排版等。
- **先直接啟動 preview 探測登入狀態**：開預覽後看畫面是否已登入（header 顯示帳號、能進 Today/Plan 操作）。**已登入就直接開始**手動驗收。**未登入時先自助登入**：`POST /api/dev-login`（見下節）能重接持久 session，多數情況免使用者介入；**只有 dev-login 也失敗時**（種子過期、或這台機器 / worktree 第一次設定）**才告知使用者、請其協助**完成 device flow（WSPC 端按 Approve）後再續跑。
- 對照該 spec 的「驗收標準」逐項手動驗收。

理由：這個專案大量是視覺 / 互動打磨，單元測試抓不到觀感與真實資料流；手動 preview 驗收是必要補充。

## 寫 plan 時：最後一個 task 產生驗收報告

寫 implementation plan（`docs/superpowers/plans/**`）時，**最後一個 task 一律是「手動驗收 + 產生驗收報告」**：執行該 task 時，全程用 `playwright-cli` 驗收並把報告寫到 gitignored 的 `docs/acceptance-reports/<plan-slug>/`（截圖在底下 `assets/`）。報告格式、playwright-cli 截圖落地流程、範本，見 [.claude/rules/acceptance-report.md](.claude/rules/acceptance-report.md)（path-scoped 到 plans，讀 plan 時自動載入）。

理由：`preview_screenshot` 是 inline JPEG、不落地，報告引不到；`playwright-cli screenshot --filename` 才能把截圖寫進報告目錄。machine 一次性前置：`npm i -g @playwright/cli@latest` + `playwright-cli install --skills`。

## 本機 preview 登入（dev-login + 新 worktree）

手動驗收要登入真實 WSPC。為了不用每次都跑 device flow，有 dev-only 的 `POST /api/dev-login`（`DEV_LOGIN=true` gated、永不進 production）：一次 device flow 後，它把 cookie 重接回持久化的 real-WSPC session，之後免登入。

**設定流程**：

- **每個新 worktree 開工先跑一次 `npm run setup:dev`** —— 把機器層級的 `~/.desk-dev/.dev.vars` 複製進這個 worktree 的 `.dev.vars`（wrangler / vite-plugin 只從專案根讀 `.dev.vars`，且它 gitignored、不跨 worktree）。canonical 檔放 home 目錄、不在 worktree 裡，所以 worktree 被刪也不影響。
- **這台機器第一次**（`~/.desk-dev/.dev.vars` 還沒種子）：`setup:dev` 會先建只含 `DEV_LOGIN=true` 的 canonical 檔。開 preview 走一次 device flow（**用測試帳號**）→ `POST /api/dev-login` 回傳 `refreshToken` + `userId` + `clientId` → 把這三行填回 `~/.desk-dev/.dev.vars`（`DEV_REFRESH_SEED=` / `DEV_USER_ID=` / `DEV_CLIENT_ID=`）→ 之後所有 worktree 都能自助登入。`clientId` 不可省：refresh token 綁定發給它的 OAuth client，fresh worktree 的空 KV 沒有它就 refresh 不了。
- **種子會因 WSPC refresh-token rotation 偶發失效**：若 dev-login 報 `seed_refresh_failed`，重跑一次 device flow capture、更新 canonical 檔即可。

> ⚠️ canonical `.dev.vars` 是明文存測試帳號的 refresh token，**只用丟棄式測試帳號，絕不放個人帳號**。

## 改動 UI 互動後要跑 e2e

改到 **Today 互動**（task row 動作、優先權、計畫外 / 內切換）、**登入流程**、或任何使用者操作流程後，**除了 `npx vitest run` 也要跑 e2e**：`npm run test:e2e`（Playwright，對真實 BFF + mock WSPC）。

理由：vitest 跑在 jsdom，抓不到 portal menu、focus 行為、task 跨 section 移動、真實 DOM 互動這些東西。只跑 vitest 就改互動，會在 CI 的 Playwright job 才爆（例如把 row 動作收進 overflow menu 後，e2e 還在點舊按鈕）。改互動 = 連同 `e2e/*.spec.ts` 一起更新並在本機跑過。

e2e 的 server 位址在 `playwright.config.ts` 固定用 `127.0.0.1`（含 `vite --host 127.0.0.1`）—— Vite 在 Windows 預設 listen `::1`、Linux listen `127.0.0.1`，不釘死會讓 Windows 本機跑不起來。

## 型別檢查一律用 `npm run build`（不要用 `tsc -p tsconfig.json --noEmit`）

驗證型別**只信 `npm run build`（= `tsc -b && vite build`）**，這也是 CI / Cloudflare deploy build 跑的指令。

**不要用 `npx tsc -p tsconfig.json --noEmit` 當型別檢查** —— 根 `tsconfig.json` 是 solution-style（`files: []` + 只有 `references`），`tsc -p` 對它**等於什麼都沒查**（no-op、永遠 clean），會給出假綠。Slice 3 就因此讓真型別錯（元件少傳必填 prop、測試檔 `it`/`expect` 沒 import）一路漏到 CI deploy build 才爆。

`tsc -b` 會檢查所有 referenced project（含測試檔），所以：測試檔要**顯式 `import { describe, it, expect } from "vitest"`**（本專案不靠 global，雖然 vitest run 有 globals）。

## 慣例

- 程式碼與註解一律英文；對話與文件敘述用繁體中文（spec / plan / research 文件全中文，程式碼區塊維持英文）。
- 安裝相依套件需 `npm install --legacy-peer-deps`（openapi-typescript 與 typescript 6 的 peer 衝突）。
- 型別檢查用 `npm run build`（見上節），不要用 `tsc -p tsconfig.json --noEmit`（no-op 假綠）。
