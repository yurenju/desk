# desk.yurenju.me

個人儀表板（整合 Mail / Calendar / Todo），跑在 Cloudflare Workers，後端用 WSPC（https://wspc.ai）。開發策略與進度見 [ROADMAP.md](ROADMAP.md)：垂直切片，每片可 demo。

## 撰寫 spec 時

寫設計文件（`docs/superpowers/specs/**`）的「測試策略」時，除了自動化測試（vitest / Testing Library / e2e），**一律加入「手動測試（preview + AI agent）」一項**：

- 由 AI agent 透過 `preview_start` 開預覽，實際操作畫面驗證視覺與互動 —— 那些難用單元測試涵蓋的觀感、過場、觸控目標、響應式排版等。
- 需要真實登入時（WSPC device flow 要在 WSPC 端按 Approve），**請使用者協助完成登入**後再續跑驗證。
- 對照該 spec 的「驗收標準」逐項手動驗收。

理由：這個專案大量是視覺 / 互動打磨，單元測試抓不到觀感與真實資料流；手動 preview 驗收是必要補充，且涉及 WSPC 登入時必須有使用者在場。

## 慣例

- 程式碼與註解一律英文；對話與文件敘述用繁體中文（spec / plan / research 文件全中文，程式碼區塊維持英文）。
- 安裝相依套件需 `npm install --legacy-peer-deps`（openapi-typescript 與 typescript 6 的 peer 衝突）。
