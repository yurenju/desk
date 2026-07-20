# ADR-0001:欄位變更型 op 由單一 `apply` 依 diff 自動持久化

- 狀態:Accepted
- 日期:2026-07-20

## 背景

`src/store/tasks.ts` 原本有約 20 個 async action,每個都重複同一段舞步:抓 `prev` → 跑 `taskOps` 的 pure op 算出 `next` → 樂觀 `set` → `enqueuePatch` 一組**手挑**的 custom fields → 失敗回滾。

問題在「手挑欄位」:op 內部(透過 `patch()`)已經知道自己改了什麼,但 store 又另外把同一組欄位重列一遍送去 PATCH。同一份知識存在兩處,會 drift —— op 改了某欄位、store 忘了送,畫面與 server 靜默分歧到下次 reload 才修正。`setDailyPriority` / `setMonthlyPriority` / `reorderPriority` 甚至各自用 `JSON.stringify` 手算 diff,其 `?? []` 正規化還讓「evict 一個帶 legacy `daily_priority` 的 collider」時漏送清除、留下 stale 值。

## 決策

新增 `src/store/applyOp.ts` 的 `deriveTodoPatch(prev, next)`:比對兩個 task 在**持久化欄位**(top-level `status`/`title`/`description` + 全部 `custom_fields`)的最小 diff,是「該送哪些欄位」的**單一 home**。

store 收斂出單一 `apply(transform)`:抓 `prev` → 跑 transform → 對 reference 改變的 task 用 `deriveTodoPatch` 導出 wire patch → 樂觀 `set` → `enqueuePatch`。15 個欄位變更型 action 各自塌成一行 `apply(prev => xxxOp(prev, …))`。

`taskOps` 的 pure op **不改**(仍回傳 `Task[]`);locality 從「store 手挑」搬回「op 描述 state 變更,differ 描述如何持久化」。

不變式(測試釘死):
- 欄位在 `prev` 有、`next` 被移除 → wire 送 `null`(清除),不得省略。
- 空 patch(reference 變了但無持久化差異)不 enqueue、不計入 reload 判斷。
- 失敗處理由 changed 數量推斷:單 id → 回滾 `prev`;多 id → `reload()`(部分 `Promise.all` 失敗無法逐一原子回滾)。

wire 語意改為**最小 diff**:原本無條件超送的冗餘 `null` / `[]` 不再送(皆為 no-op)。

## 範圍

只涵蓋 15 個欄位變更型 action。`create`(3)/`deleteTask`/`restoreTask` 維持 bespoke —— 它們是 task 增減、帶 temp-id 認領與 `recentlyDeleted` 記帳等正交關注點,硬塞進 `apply` 只會把 interface 撐大(變淺)。

## 後果

- store 由 ~529 行降到 ~348 行;新 action 幾乎免費(一行 + 一個 pure op)。
- 可測性:op 的 state 斷言(無 mock)+ differ 的 per-op patch 表格 + `apply` lifecycle 三者分離。
- 修掉一個 latent bug:evict legacy-priority collider 現在會正確持久化清除。
- 代價:wire byte 不再與舊版逐位元相容(已評估差異皆為 no-op)。

未來的架構評估請勿把 store 的「手挑 pattern」當新發現重提 —— 那是本 ADR 刻意消除的。
