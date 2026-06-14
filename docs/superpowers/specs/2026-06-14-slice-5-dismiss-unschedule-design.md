# Slice 5 剩項 + 移除 carryover banner — 設計文件

**日期**:2026-06-14
**對應 ROADMAP**:Slice 5（Dismiss / Unschedule 實寫入）剩餘四項 + Slice 6 的「移除 carryover banner」

## 背景與目標

Slice 5 已 ship 的只有 Focus 日層級「丟回月度」。本片補完 Slice 5 剩下的四項，並一併把從 Slice 0 留到現在、純靜態示意（吃 mock、按鈕全 `disabled`）的兩個 carryover banner 移除。

移除 banner 的決策背景見 [ROADMAP.md](../../../ROADMAP.md) Slice 6:per-row 的「移到今天 / 丟回月度」已涵蓋 carryover 的「動作」面;banner 唯一獨有的「主動浮現 stale 任務」決定不另做,改靠翻日 / 翻週(pull)。

**本片範圍(五塊)**:

- **A** — 兩個月層級純函式 op:`moveToNextMonth`、`demoteToBacklog`
- **B** — Plan 月列選單抽共用 builder + 加上述兩個動作
- **C** — 軌跡列(forwarded / dismissed)可勾完成
- **D** — Focus 的 `MonthDigest` 精簡成「進度 + 本月三件大事 + 回 Plan 連結」
- **E** — 移除 carryover banner

**不做**:日 / 月 carryover 自動偵測與 banner 動作;stale 任務的主動浮現機制;月底 Review 介面(待議)。

## 現有架構(本片貼著它走)

資料流分層,每層職責單一:

```
純函式 op (taskOps.ts)  →  store action (tasks.ts)  →  useXxxRow hook  →  menu builder / 元件
```

關鍵既有檔案:

- [src/store/taskOps.ts](../../../src/store/taskOps.ts) — 純函式,輸入 `Task[]` 輸出 `Task[]`,已有 `moveToToday` / `demoteToMonth` 可對稱參考。
- [src/store/tasks.ts](../../../src/store/tasks.ts) — zustand store,每個 action 樂觀更新 + 失敗回滾到 `prev`。
- [src/features/day/taskRowMenu.ts](../../../src/features/day/taskRowMenu.ts) — `buildTaskRowMenuItems`,日列選單的單一真實來源(`TaskRow` 與 `Top3Item` 共用,避免 drift)。月列尚未有對應的共用 builder。
- [src/lib/tasks.ts](../../../src/lib/tasks.ts) — `primaryDate` / `primaryMonth` / `tasksOnDate` / `tasksOnMonth`,軌跡 `kind`(primary / forwarded / dismissed)推導。

## A. 兩個月層級純函式 op

在 [taskOps.ts](../../../src/store/taskOps.ts) 新增兩個 op,與 `moveToToday` / `demoteToMonth` 對稱。

### `moveToNextMonth(tasks, id, nextMonth)`

把月任務往後順延一個月。

```
function moveToNextMonth(tasks, id, nextMonth):
  target = find(id); if !target return tasks
  months = target.scheduled_months ?? []
  if last(months) === nextMonth return tasks          // already there, no-op
  patch:
    scheduled_months = [...months, nextMonth]          // append-only
    monthly_priority = undefined                       // clear rank, 下月重排
```

設計決定:**清掉 `monthly_priority`** —— 下個月是全新的三件大事排名,讓使用者進下月再挑(與 `moveToToday` 重新 assign `daily_priority` 的精神一致)。

### `demoteToBacklog(tasks, id, today)`

把月任務丟回 backlog 層。

```
function demoteToBacklog(tasks, id, today):
  target = find(id); if !target return tasks
  months = target.scheduled_months ?? []
  if months.length === 0 return tasks                  // already backlog, no-op
  patch:
    unscheduled_month = last(months)                   // dismiss the active month
    unscheduled_at = today                             // also dismiss any residual day scheduling
    monthly_priority = undefined
    daily_priority = undefined
```

寫 `unscheduled_at = today` 是防呆:確保即使該 task 殘留日排程,也一併 dismiss,讓 `layer(task)` 真的落回 `backlog`(對照 [tasks.ts](../../../src/lib/tasks.ts) 的 `primaryMonth` / `primaryDate` / `layer` 推導)。

### 對應 store action

在 [tasks.ts](../../../src/store/tasks.ts) 加兩個 action,照 `demoteToMonth`(line 316)的寫法:樂觀更新 → `enqueuePatch` 只送變動欄位 → catch 回滾 `prev`。

```
async moveToNextMonth(id):
  prev = tasks
  nextMonth = monthOf(addMonths(today, 1))             // 由 store 的 today 推導
  next = moveToNextMonthOp(prev, id, nextMonth)
  if next === prev return
  set(next); enqueuePatch(id, { scheduled_months, monthly_priority: null }) catch → rollback

async demoteToBacklog(id):
  prev = tasks
  next = demoteToBacklogOp(prev, id, today)
  if next === prev return
  set(next); enqueuePatch(id, { unscheduled_month, unscheduled_at, monthly_priority: null, daily_priority: null }) catch → rollback
```

> 注意 `enqueuePatch` 對「清空」欄位送 `null`(不是 `undefined`),與既有 `demoteToMonth` / `setDailyPriority` 一致 —— op 層用 `undefined` 刪 key,patch 層用 `null` 告訴 server 清值。

`addMonths` 若 [src/lib/date.ts](../../../src/lib/date.ts) 尚無,實作時補一個純函式(跨年進位)。

## B. Plan 月列選單抽共用 builder + 加兩動作

現況:[MonthRow.tsx](../../../src/features/month/MonthRow.tsx) 的 `⋯` menu 是 inline items 陣列(line 99);[MonthHeroCard.tsx](../../../src/features/month/MonthHeroCard.tsx) 很可能各有一份 → 加動作要改兩處、易 drift(與當初日列抽 `taskRowMenu.ts` 前同樣的問題)。

**做法**:新增 `src/features/month/monthRowMenu.ts`,匯出 `buildMonthRowMenuItems`,仿 [taskRowMenu.ts](../../../src/features/day/taskRowMenu.ts) 的形狀(吃 `task` / `selectedDate` / `useMonthRow` 回傳值,回 `MenuItemSpec[]`)。`MonthRow` 與 `MonthHeroCard` 改用同一份。

選單新增兩項(接在 promote 群組之後、編輯 / 刪除之前):

```
{ key: "move-next-month", label: "↪ 移到下月",     onSelect: row.moveToNextMonth }
{ key: "demote-backlog",  label: "↩ 丟回 Backlog", onSelect: row.demoteToBacklog }
```

`useMonthRow`([useMonthRow.ts](../../../src/features/month/useMonthRow.ts))補兩個動作:

```
moveToNextMonth: () => moveToNextMonth(id)
demoteToBacklog: () => demoteToBacklog(id)
```

**只在 Plan 的 `MonthColumn` 生效** —— `MonthDigest` 經 D 段改造後不再 render 可編輯月列,故不受影響。

## C. 軌跡列可勾完成(forwarded / dismissed)

現況:[TaskRow.tsx](../../../src/features/day/TaskRow.tsx) 與 [MonthRow.tsx](../../../src/features/month/MonthRow.tsx) 的 `editable = interactive && kind === "primary"`,checkbox `disabled={!editable}` → 軌跡列完全不能勾。

ROADMAP「軌跡顯示規則」要求:順延 / 略過軌跡列**唯讀,但可勾選完成(同一 entity)**。

**做法**:把單一 `editable` 拆成兩個概念:

```
editable  = interactive && kind === "primary"   // ring / 編輯 / menu / 刪除(不變)
checkable = Boolean(interactive)                // checkbox 可勾,所有 kind 皆可
```

checkbox 改:

```
disabled = !checkable
onCheckedChange = checkable ? row.toggle : undefined
```

`done_on` 寫入與 `✓ 完成樣式`:`toggleDone`([taskOps.ts](../../../src/store/taskOps.ts) line 19)已寫 `done_on`,`styles.done` 已套用 → ROADMAP Slice 5 第 4 項「完成 trail task 後 done_on + ✓ 樣式」基本跟著本段完成。需確認的是「軌跡樣式 + done 樣式疊起來」的視覺正確(手動驗收)。

TaskRow 與 MonthRow 兩處皆改。

## D. Focus MonthDigest 精簡為唯讀摘要 + 回 Plan 連結

現況:[MonthDigest.tsx](../../../src/features/month/MonthDigest.tsx) 顯示 header / 進度 / 本月三件大事(Top3Card)/「其他 (n)」MonthRow 清單。

**改為只留三塊**:

1. **進度** — header + `ProgressBar` + 標籤,**不動**。進度標籤的 `完成 X/Y` 仍以全部本月 `primary`(含未顯示的其他)計算,反映整月真實進度,只是不把它們列出來。`primary` 變數因此保留。
2. **本月三件大事** — `Top3Card variant="plain"`(唯讀),**不動**。
3. **移除整個「其他 (n)」section** — 連帶移除 `MonthRow` import 與 `others` 變數。
4. **新增回 Plan 連結** — 接在最後:

```
<Link to="/plan/$date" params={{ date: selectedDate }}>在計畫頁編輯本月 →</Link>
```

為了讓連結落在 digest 顯示的同一個月,`MonthDigest` 多收一個 `selectedDate` prop(由 [TodayLayout.tsx](../../../src/features/plan-view/TodayLayout.tsx) 傳入),避免 Focus 檢視非今天日期時連結跳錯月。`today` prop 維持原用途(進度 `pct`、Top3Card `date`)。

**設計理由**:digest 回到「降權摘要」、編輯動線集中在 Plan,符合 Slice 3.5 確立的 Plan(升權規劃)/ Focus(降權執行)區分。

## E. 移除 carryover banner

純移除,無替代:

- 刪 `src/features/carryover/CarryoverBanner.tsx` 與 `CarryoverBanner.module.css`(整個 `src/features/carryover/` 目錄)。
- 移除 [TodayLayout.tsx](../../../src/features/plan-view/TodayLayout.tsx) line 25 與 [PlanLayout.tsx](../../../src/features/plan-view/PlanLayout.tsx) line 168 的 `<CarryoverBanner>` 使用與 import。
- 刪 [src/mock/data.ts](../../../src/mock/data.ts) 的 `MOCK_CARRYOVER_DAY` / `MOCK_CARRYOVER_MONTH` 及其在 layout 的 import。
- 清掉任何 banner 專屬測試(實作時 grep `CarryoverBanner` / `MOCK_CARRYOVER` 確認;`tasks.test.ts` 等檔的 "carryover" 多指 per-row 動作,須逐一辨別,勿誤刪)。

## 元件邊界與隔離

每塊都可獨立理解、獨立測試:

| 單元 | 職責 | 依賴 |
|---|---|---|
| `moveToNextMonth` / `demoteToBacklog`(op) | 純資料轉換 | 無(純函式) |
| store actions | 樂觀更新 + patch + 回滾 | op、`enqueuePatch`、`addMonths` |
| `buildMonthRowMenuItems` | 月列選單單一真實來源 | `useMonthRow` 回傳型別 |
| `MonthDigest` | 唯讀摘要 + 連結 | `tasksOnMonth`、`Top3Card`、router `Link` |

## 測試策略

### 自動化(vitest / Testing Library)

- **op 層**(`taskOps.test.ts`):
  - `moveToNextMonth`:append 下月、清 `monthly_priority`、已是 last 時 no-op、跨年(12 月 → 隔年 1 月)。
  - `demoteToBacklog`:寫 `unscheduled_month = last` + `unscheduled_at = today`、清兩個 priority、落回 `layer === "backlog"`、無月份時 no-op。
- **store 層**(`tasks.test.ts`):兩個 action 的樂觀更新與失敗回滾(mock `enqueuePatch` reject → 還原 `prev`)。
- **元件層**:
  - 軌跡列(forwarded / dismissed)checkbox `disabled === false`、勾選呼叫 `toggleDone`;primary 維持 menu / ring;done + trail 樣式 class 並存。
  - `MonthDigest` 不再 render「其他」section、不再 import `MonthRow`、回 Plan 連結 `href` 指向 `/plan/<selectedDate>`。
  - 月列選單含「移到下月 / 丟回 Backlog」兩項且呼叫對應 row 動作。

### e2e(`npm run test:e2e`,對真實 BFF + mock WSPC)

本片改到 **Today/Focus 互動**(TaskRow checkbox 行為)與 **Plan 月列動作**,依 [CLAUDE.md](../../../CLAUDE.md)「改 UI 互動後要跑 e2e」必跑。新增 / 更新:

- 軌跡列勾完成 → 切換 ✓ 樣式(jsdom 抓不到的真實 DOM)。
- Plan 月列「移到下月 / 丟回 Backlog」後該 task 在月欄消失 / 變化。
- 既有涉及 banner 的 e2e(若有)移除對 banner 的斷言。

### 手動測試(preview + AI agent)

由 AI agent 透過 `preview_start`(共用 profile)實際操作驗證視覺與互動,逐項對照下方驗收標準:

- 先直接啟動 preview 探測登入狀態;已登入直接驗收,未登入才請使用者協助 device flow。
- 重點看單元測試涵蓋不到的觀感:軌跡列「唯讀但可勾」的手感與視覺、done + 軌跡疊樣式、精簡後 MonthDigest 的版面與連結點擊、banner 消失後兩個 layout 的間距是否正常、月列新選單項的對齊與點擊。

## 驗收標準

1. Plan 月列 `⋯` menu 出現「移到下月」「丟回 Backlog」,且 `MonthRow` 與 `MonthHeroCard` 兩處一致(共用 builder)。
2. 「移到下月」:該月任務 `scheduled_months` append 下月、`monthly_priority` 清空;月欄即時反映。
3. 「丟回 Backlog」:任務離開月欄、落回 backlog(`unscheduled_month` / `unscheduled_at` 寫入,兩個 priority 清空)。
4. 兩個動作失敗(server reject)時樂觀更新回滾、顯示錯誤 toast。
5. Focus / Plan 的日軌跡列(順延 / 退回月度)checkbox 可勾,勾選後寫 `done_on` 並轉 ✓ 完成樣式;其餘動作(ring / 編輯 / menu)在軌跡列不出現。
6. Plan 月欄的月軌跡列同樣可勾完成。
7. MonthDigest 只顯示「進度 + 本月三件大事 + 回 Plan 連結」,不再有「其他」清單;進度的完成數仍含未顯示的其他任務。
8. MonthDigest 的連結點下去進入 `/plan/<該月焦點日>`。
9. Focus 與 Plan 兩個畫面都不再出現 carryover banner;移除後版面無破洞。
10. `npm run build`(型別)、`npx vitest run`、`npm run test:e2e` 全綠。

## 風險與注意

- **誤刪 carryover per-row 測試**:`tasks.test.ts` 等檔同時含 banner 與 per-row 動作的 "carryover" 字樣,移除 banner 時須逐一辨別,只刪 banner 專屬部分。
- **`enqueuePatch` 清值語意**:清欄位送 `null` 而非 `undefined`,沿用既有 action 慣例,勿混用。
- **MonthRow / MonthHeroCard 抽共用時的既有差異**:兩者目前選單可能已不完全相同,抽 builder 前先 diff,確認合併後不丟既有項目。
