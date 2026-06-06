# desk.yurenju.me

個人儀表板（整合 Mail / Calendar / Todo），跑在 Cloudflare Workers，後端用 WSPC（https://wspc.ai）。開發策略與進度見 [ROADMAP.md](ROADMAP.md)：垂直切片，每片可 demo。

## 撰寫 spec 時

寫設計文件（`docs/superpowers/specs/**`）的「測試策略」時，除了自動化測試（vitest / Testing Library / e2e），**一律加入「手動測試（preview + AI agent）」一項**：

- 由 AI agent 透過 `preview_start` 開預覽，實際操作畫面驗證視覺與互動 —— 那些難用單元測試涵蓋的觀感、過場、觸控目標、響應式排版等。
- 需要真實登入時（WSPC device flow 要在 WSPC 端按 Approve），**請使用者協助完成登入**後再續跑驗證。
- 對照該 spec 的「驗收標準」逐項手動驗收。

理由：這個專案大量是視覺 / 互動打磨，單元測試抓不到觀感與真實資料流；手動 preview 驗收是必要補充，且涉及 WSPC 登入時必須有使用者在場。

## 改動 UI 互動後要跑 e2e

改到 **Today 互動**（task row 動作、優先權、計畫外 / 內切換）、**登入流程**、或任何使用者操作流程後，**除了 `npx vitest run` 也要跑 e2e**：`npm run test:e2e`（Playwright，對真實 BFF + mock WSPC）。

理由：vitest 跑在 jsdom，抓不到 portal menu、focus 行為、task 跨 section 移動、真實 DOM 互動這些東西。只跑 vitest 就改互動，會在 CI 的 Playwright job 才爆（例如把 row 動作收進 overflow menu 後，e2e 還在點舊按鈕）。改互動 = 連同 `e2e/*.spec.ts` 一起更新並在本機跑過。

e2e 的 server 位址在 `playwright.config.ts` 固定用 `127.0.0.1`（含 `vite --host 127.0.0.1`）—— Vite 在 Windows 預設 listen `::1`、Linux listen `127.0.0.1`，不釘死會讓 Windows 本機跑不起來。

## 慣例

- 程式碼與註解一律英文；對話與文件敘述用繁體中文（spec / plan / research 文件全中文，程式碼區塊維持英文）。
- 安裝相依套件需 `npm install --legacy-peer-deps`（openapi-typescript 與 typescript 6 的 peer 衝突）。
