# 月份欄改版設計：摺疊已完成 + 拖延訊號

## 背景與問題

規劃頁（`/plan`）左側「MONTH · 規劃」欄目前把當月任務平鋪成一長串，實測要捲 4 個畫面才到底。兩個使用者回報的問題：

1. **清單太長、done/undone 混雜**：「其他計劃內」「計劃外」兩段都沒過濾已完成，打勾的（刪節線、變暗）跟未完成的交錯排列，光「其他計劃內」就佔 2.5 個畫面，找「還沒做的」得用眼睛濾掉刪節線。
2. **看不出哪些排過卻沒做**：排本週要做的事時，無法分辨哪些任務早就排進這個月、或排到某天卻落掉了（有拖延嫌疑）。清單沒有任何時間／拖延的維度。

對應的 wspc 任務：`tod_01KVKSHVZJEH6TFDP3A31BEMTX`（清單太長）、`tod_01KVKSSN1T5WM8PNTN58F573KD`（看不出拖延）。

## 現況

`src/features/month/MonthColumn.tsx` 目前的組裝邏輯：

- `entries = tasksOnMonth(allTasks, month)`：所有 `scheduled_months` 含當月的任務，每筆帶一個 `TrailKind`（`primary` / `forwarded` / `dismissed`）。
- `top3`：`primary` 且有 `monthly_priority`，走獨立的 `MonthHeroCard`。
- `otherPlanned`：`primary`、無 `monthly_priority`、`is_adhoc !== "true"` → 「其他計劃內」段。
- `adhoc`：`primary`、無 `monthly_priority`、`is_adhoc === "true"` → 「計劃外」段，帶 `UnplannedChip`。
- `trails`：`kind !== "primary"`（forwarded / dismissed）→ 底部無標題段。

三個 primary 段都**沒有依 `status` 過濾**，這是 done 混入的根因。另外，「從上個月延過來」的任務在當月其實是 `kind === "primary"`（因為當月是 `scheduled_months` 最後一項），目前跟「這個月才新排的」長得一模一樣，完全沒被標出來。

欄位定義在 `src/lib/types.ts` 的 `TaskCustomFields`：`scheduled_months` / `scheduled_dates`（string[]）、`unscheduled_month` / `unscheduled_at`（string）、`monthly_priority`、`is_adhoc`、`status`。

## 設計

分三塊。全部純前端、從現有 `custom_fields` 衍生，**不改 wspc schema**。

### 第一塊：結構（摺疊已完成 + 合併兩段）

- **top3 維持現狀**：走 `MonthHeroCard`，永遠展開，連已完成也照顯示勾選狀態（只有三項、又是最重要的，不該被藏）。
- **合併 `otherPlanned` + `adhoc` 成一條「其他任務」清單**：兩者重要度相同，不再分段。原本的 `UnplannedChip` 紅 tag 留在計劃外那些列上，當**來源標示**（仍看得出哪些是計劃外），但不再各自成一段。
- **已完成摺疊**：這條清單裡 `status === "done"` 的項目，全收進底部一個 `▸ 已完成 (N)` 群組，預設收合、可點開。未完成的留在上面。
- **trail 列依「使用者實際在看什麼」重新分組**（後續調整，原設計曾打算不動 trails，驗收時發現已完成的 trail 散在清單裡很突兀，故改）。月份欄內除 top3 外的所有列，依狀態分三組：
  - **其他任務**（展開）：`kind === "primary"` 且未完成 —— 真正這個月要做的，帶拖延點。
  - **▸ 已完成 (N)**（收合）：**所有**已完成的列，不論原本是 primary 還是 forwarded / dismissed（「做完就是做完」）。
  - **▸ 已移走 (N)**（收合）：未完成的 forwarded（`↪`）/ dismissed（`·略過`）—— 曾排這個月、現在不在了的幽靈列，每列保留 `↪` / `·略過` 標記。
- 兩個摺疊群組共用一個 `CollapseGroup` 小元件（預設收合）。

合併後「其他任務」段的順序維持現有插入順序，**不重排**（見「刻意不做」）。

### 第二塊：拖延訊號（清單端，雙色點）

在「其他任務」段的**未完成**列標題前，加一顆 6px 圓點，依拖延狀態上色：

- 🔴 **跨月延遲**：`scheduled_months` 裡有比當月更早的月份（例：5 月就排了，拖到 6 月還掛著）。
- 🟡 **本月排過某天沒做**：`unscheduled_at` 落在當月（這個月曾排到某一天、那天過了沒做、被退回月層）。
- 兩者皆中 → 顯示 🔴（取較嚴重者）。
- 無拖延 → 顯示一顆**透明佔位點**（不上色），讓所有列標題左緣對齊。

清單端**只放這顆點、不放文字**。滑鼠 hover 時用原生 `title` 給一句短說明（例：「5 月排入，拖 1 個月」）當廉價補充。已完成的列（在摺疊群組內）不顯示拖延點。

判定邏輯（衍生函式，放 `src/lib/tasks.ts`）：

```ts
export type DelayKind = "none" | "dismissed" | "carried";

// month: 當月 "YYYY-MM"
export function delayKind(t: Task, month: string): DelayKind {
  const months = t.custom_fields.scheduled_months ?? [];
  const carried = months.some((m) => m < month);
  if (carried) return "carried"; // 🔴 較嚴重，優先
  const u = t.custom_fields.unscheduled_at ?? "";
  const dismissedThisMonth = u.startsWith(month); // "2026-06-15".startsWith("2026-06")
  if (dismissedThisMonth) return "dismissed"; // 🟡
  return "none";
}
```

### 第三塊：詳情頁排程軌跡（細節的家，兩個結論摘要）

`src/features/task-detail/TaskDetailModal.tsx` 加一個「拖延狀況」區塊，把細節從清單卸到這裡，採**兩個結論摘要**而非完整事件流：

- 🔴 跨月拖延 **N 個月**（`N = 當月 − min(scheduled_months)`，以月為單位），附「最早 M 月就排了」。
- 🟡 本月排到某天沒做 **有/無**（目前只存最後一筆 `unscheduled_at`，只能判定「發生過」，不做次數計數），附該日期。

只在對應狀態成立時顯示該行；兩者皆無拖延則整個區塊不顯示。

**為何不做完整事件流**：資料只存 `scheduled_months` / `scheduled_dates` 兩個日期陣列 + 單一的 `unscheduled_month` / `unscheduled_at`，**沒有逐筆操作時間戳**。完整時序（何時排入、何時順延、何時退回）有一半得用猜的、不保證正確。兩個結論則是誠實地直接從現有欄位算得出來。

## 元件邊界

| 單元 | 職責 | 依賴 |
| --- | --- | --- |
| `delayKind(task, month)`（`tasks.ts`） | 算單一任務在當月的拖延狀態（none/dismissed/carried） | `custom_fields.scheduled_months`、`unscheduled_at` |
| `delaySummary(task, month)`（`tasks.ts`） | 算詳情頁要的兩個結論（拖 N 月、本月是否落掉過 + 日期） | 同上 + `scheduled_dates` |
| `MonthColumn` | 合併兩段、切出 done 群組、組裝清單 | `tasksOnMonth`、上面兩個衍生函式 |
| `MonthRow` | 多畫一顆拖延點（含透明佔位）+ hover `title` | `delayKind` |
| `已完成` 摺疊群組（`MonthColumn` 內，可抽小元件） | 收合/展開 done 列、顯示 (N) | done 子集 |
| `TaskDetailModal` 拖延區塊 | 顯示兩個結論摘要 | `delaySummary` |

## 刻意不做（YAGNI）

- **不改排序**：拖延項不自動浮到清單頂。雙色點已足以掃視定位。等實際用一陣子真的痛再加。
- 不動 WEEK / DAY 欄、不動 backlog。（trail 列的分組調整見「第一塊」後續調整。）
- **不做拖延次數真實計數**：`unscheduled_at` 只存最後一筆，只判定「有沒有」。

## 測試策略

- **單元測試（vitest）**：
  - `tasks.test.ts` 補 `delayKind` / `delaySummary`：跨月（`scheduled_months` 含更早月份）、本月 `unscheduled_at`、兩者皆中取 🔴、皆無 → none、邊界（`unscheduled_at` 為上月日期不算本月落掉）。
  - `MonthColumn.test.tsx`：done 收進摺疊群組、未完成留在上面、`otherPlanned` + `adhoc` 合併後仍保留 `UnplannedChip`、摺疊預設收合。
  - `MonthRow.test.tsx`：依 `delayKind` 畫對應顏色的點、無拖延畫透明佔位、done 列不畫點、hover `title` 內容。
  - `TaskDetailModal.test.tsx`：兩個結論各自的顯示／隱藏條件。
- **e2e（Playwright，`npm run test:e2e`）**：本案改到月份欄的清單呈現與摺疊互動，需更新 / 新增 `e2e/*.spec.ts` 涵蓋「展開已完成群組」「拖延點存在」，並在本機跑過（先停掉 preview dev server 再跑，避免 port 衝突）。
- **手動測試（preview + AI agent）**：由 AI agent 先用共用 profile 開 preview 探登入狀態（已登入直接驗收，未登入才請使用者協助 device flow）。逐項對照驗收標準：
  - 月份欄整體高度明顯縮短，未完成項目集中在上方。
  - 已完成預設收合成 `▸ 已完成 (N)`，可展開。
  - top3 永遠展開、含已完成的勾選狀態。
  - 計劃內／計劃外合併成一條，計劃外仍有紅 tag。
  - 拖延的列前面有對應顏色的點、標題仍對齊；hover 出現短說明。
  - 點進有拖延的任務，詳情頁「拖延狀況」顯示對應的一～兩行結論。

## 驗收標準

1. 月份欄已完成項目預設收合在底部 `▸ 已完成 (N)`，未完成項目不被已完成稀釋。
2. top3 不受摺疊影響，永遠顯示且含完成狀態。
3. 「其他計劃內」與「計劃外」合併為單一清單，計劃外保留來源 tag。
4. 未完成且跨月延遲的列顯示 🔴 點；本月排過某天沒做的列顯示 🟡 點；無拖延顯示透明佔位點且標題對齊。
5. 詳情頁對有拖延的任務顯示「拖延狀況」摘要（拖 N 月 / 本月落掉過 + 日期）；無拖延則不顯示該區塊。
6. 純前端衍生，未變更任何 wspc 寫入或 schema。
7. `npm run build`、`npx vitest run`、`npm run test:e2e` 皆通過。
