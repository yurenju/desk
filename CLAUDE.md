# desk.yurenju.me

個人儀表板（整合 Mail / Calendar / Todo），跑在 Cloudflare Workers，後端用 WSPC（https://wspc.ai）。專案概觀見 [README.md](README.md)。

v1 的 Todo 工作流（三層漏斗：Backlog / Monthly / Daily，Plan 規劃 + Focus 專注兩個鏡頭）已實作到「可實際每天用」並先用一陣子再迭代；Calendar / Mail 為後續階段。排程語意全靠 WSPC todo 的 custom fields 表達，完整欄位語意與「用 wspc MCP 操作 Desk 帳號」的對照見 [docs/wspc-mcp-operations.md](docs/wspc-mcp-operations.md)。

## 撰寫 spec 時

寫設計文件（`docs/superpowers/specs/**`）的「測試策略」時，除了自動化測試（vitest / Testing Library / e2e），**一律加入「手動測試（preview + AI agent）」一項**：

- 由 AI agent 透過 `preview_start` 開預覽，實際操作畫面驗證視覺與互動 —— 那些難用單元測試涵蓋的觀感、過場、觸控目標、響應式排版等。
- **先直接啟動 preview 探測登入狀態**：用共用 profile 開（見下節），看畫面是否已登入（header 顯示帳號、能進 Today/Plan 操作）。**已登入就直接開始**手動驗收。**未登入時 agent 自己走 email OTP 登入**（用專用測試信箱 + wspc MCP 讀驗證碼，完整步驟見下節），**不需要使用者介入**。共用 KV + 共用 profile 下,一次登入可撐 30 天。
- 對照該 spec 的「驗收標準」逐項手動驗收。

理由：這個專案大量是視覺 / 互動打磨，單元測試抓不到觀感與真實資料流；手動 preview 驗收是必要補充。

## 寫 plan 時：最後一個 task 產生驗收報告

寫 implementation plan（`docs/superpowers/plans/**`）時，**最後一個 task 一律是「手動驗收 + 產生驗收報告」**：執行該 task 時，全程用 `playwright-cli` 驗收並把報告寫到 gitignored 的 `docs/acceptance-reports/<plan-slug>/`（截圖在底下 `assets/`）。報告格式、playwright-cli 截圖落地流程、範本，見 [.claude/rules/acceptance-report.md](.claude/rules/acceptance-report.md)（path-scoped 到 plans，讀 plan 時自動載入）。

理由：`preview_screenshot` 是 inline JPEG、不落地，報告引不到；`playwright-cli screenshot --filename` 才能把截圖寫進報告目錄。machine 一次性前置：`npm i -g @playwright/cli@latest` + `playwright-cli install --skills`。

## 本機 preview 登入（共用 KV + 共用 playwright profile）

手動驗收要登入真實 WSPC。登入狀態靠兩個「機器層級、跨 worktree 共用」的東西撐著，**一次 device flow 可撐約 30 天、所有 worktree 共用**：

- **共用 KV state**：`vite.config.ts` 把 dev worker 的 KV（auth session + bootstrap）persist 到 `~/.desk-dev/wrangler-state`，而非每個 worktree 自己的 `.wrangler/state`。session 寫進 KV 一次，所有 worktree 的 dev server 都讀得到，且 `putSession` 每次使用會把 30 天 TTL 往後推。
- **共用 playwright profile**：AI agent 驗收一律用 `playwright-cli open --persistent --profile ~/.desk-dev/pw-profile <url>`（**不要用沒帶 `--profile` 的 `open`** —— 那是非持久、每次全新 context，cookie 會一直掉）。`__Host-Session` cookie 有 `Max-Age=30 天`，留在這個 profile 裡 → 跨呼叫、跨 worktree 都還在。

**流程**：

- agent 用 `--persistent --profile ~/.desk-dev/pw-profile` 開 preview → cookie 在、KV session 在 → 直接是登入狀態,直接驗收。
- **沒登入時**（這台機器第一次、或整整 30 天沒碰）：**agent 自己走下面的 email OTP 登入，不必找使用者**。

### agent 自助 email OTP 登入（不需要使用者）

WSPC 的登入是 **email OTP**（`/auth/request-code` + `/auth/verify-code`），desk 的 device flow 在 WSPC 端要先用 email 登入才會出現 Approve。因為驗證碼寄到我們掌控的信箱、agent 用 **wspc MCP** 讀得到，所以整條可以 agent 全自動完成，**不需要使用者按任何東西**。

- **專用測試信箱：`desk-acceptance@wspc.app`**。這是 wspc MCP 目前登入帳號（`yurenju@gmail.com`）底下建好的 email alias，OTP 信會落進這個帳號的信箱、用 `email_list --alias_email desk-acceptance@wspc.app` 讀得到。alias 是永久的，不用每次重建。
- **關鍵語意（有點繞但正確）**：拿 `desk-acceptance@wspc.app` 走 OTP 登入，WSPC 會把 desk 登入成**另一個獨立帳號**（`desk-acceptance@wspc.app`，user_id `usr_01KX26PN…`），**不是** yurenju 那個帳號。等於「用 A 帳號的 alias 收信、去登入並自動新建的 B 帳號」。好處：驗收資料落在乾淨、隔離的專用測試帳號，不會動到本人真實 todos。第一次進 desk 時 bootstrap 會自動幫 B 帳號建 project + DeskTask type，畫面一開始是空的（要驗收就自己在 UI 建幾筆）。

**步驟**（全程 playwright-cli `--persistent --profile ~/.desk-dev/pw-profile`）：

1. 開 desk `http://localhost:5173/login`，等它從「準備登入中⋯」跑出 device 授權頁，抓到「在 WSPC 開啟授權頁」連結（`https://app.wspc.ai/device?user_code=XXXX-XXXX`）與核對碼。
2. **另開一個 tab**（`tab-new <那個 url>`）去 WSPC，**別在 /login 那個 tab 導走** —— /login 要留著繼續輪詢，approve 後它會自動進站。
3. WSPC 頁會轉到 `/device/confirm`，先問 Email → 填 `desk-acceptance@wspc.app` → Continue。
4. WSPC 寄 6 位數 OTP 到該信箱。用 wspc MCP `email_list --alias_email desk-acceptance@wspc.app --limit 3` 抓最新一封，主旨就是 `Your wspc login code: NNNNNN`（`text_body` 也有）。
5. 填碼 → Verify & Continue → 出現「desk.yurenju.me requests access」，**核對畫面 user_code 與步驟 1 一致** → Approve。
6. 切回 /login 那個 tab（`tab-select 0`），它已自動進 `/focus`。`playwright-cli eval "fetch('/api/me').then(r=>r.json())"` 應回 `desk-acceptance@wspc.app`。session 已寫進共用 KV，之後 30 天免再登入。

> playwright-cli 的 `fill`/`click` target 用 snapshot 給的 ref（`e15`、`e16`…），不要用 `'textbox "Email"'` 這種帶引號的 selector（會 CSS parse error）。ref 在畫面重繪後可能失效，動畫過場時若 click 沒 land，重取一次 ref 或改用 `eval` 直接 `document.querySelector('[aria-label="…"]').click()`。

> ⚠️ 一次只跑**一個** worktree 的 dev server。兩個同時跑會共用同一份 KV session，兩邊各自去 refresh access token 會把對方 rotate 掉而 401。
>
> ⚠️ `--persistent` 的 profile 目錄同一時間只能一個瀏覽器實例用，務必跟日常 Chrome 分開（專用 `~/.desk-dev/pw-profile`）。

### agent 探測登入的固定 SOP（別再繞錯路）

手動驗收要判斷「有沒有登入」時，**一律照這個順序，不要繞去 preview MCP**：

1. **不要用 preview MCP 瀏覽器（`preview_start` / `preview_snapshot`）判斷登入。** 那個瀏覽器跟共用 profile 是**兩個不同瀏覽器**，結構上**永遠不帶** `__Host-Session` cookie → 一定顯示登出，會誤導你以為要重登。認證相關的探測**只走 playwright-cli `--persistent --profile ~/.desk-dev/pw-profile`**。
2. **先確保 5173 上跑的是共用 KV 的 dev server**：跑過 e2e 後常有殘留的 `CLOUDFLARE_ENV=e2e` dev server（隔離 KV、無真 session）占著 5173 —— 先殺掉殘留、確認你連到的是一般 `npm run dev`（共用 KV）那台，否則會拿到假 401。
3. `playwright-cli eval` 打 `/api/me`：**回 200 就直接開始驗收，不要問使用者**（這是計畫明訂的「已登入就直接做」）。**只有真的 401** 才走上一節的「agent 自助 email OTP 登入」自己重登 —— **一樣不必找使用者**。

換句話說：會「每次都停下來問」通常是第 1 步用錯瀏覽器、或第 2 步連到殘留 e2e server 造成的假登出，不是真的沒登入；就算真的沒登入，OTP 登入也是 agent 自己能做完的。

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
