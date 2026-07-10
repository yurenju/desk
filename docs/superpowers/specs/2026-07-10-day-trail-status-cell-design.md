# 設計:day trail 列的狀態格(status cell)

## 背景與問題

Focus / Plan 的單日檢視裡,一個 task 除了「計畫內(primary)」,還可能以兩種 **trail 狀態**出現在某一天的列表:

- **forwarded(移到別天)**:這天看到、但它已被往後移到別天(例如「已移到今天」)。
- **dismissed(退回本月)**:這天看到、但它已被退回月度層(「已退回本月」)。

現況這兩種 trail 列、加上「已完成」列,標題全部套同一個 `--color-ink-faint` 灰,差別只剩刪除線與一行很小的 trail 文字。三個語意不同的狀態擠在同一種灰裡,掃視時分不出「這件已經做完」還是「這件被移走了」,而「移走」本身其實有兩種(近期要處理 vs 晚點再說),現況完全沒有區分。

同時,trail 列目前唯一的操作是 checkbox 打勾;要改排程得離開這天、去它真正所在的位置操作,缺一個就地改狀態的入口。

## 目標

1. **視覺可辨識**:完成、移到別天、退回本月三種狀態各有獨立的色彩訊號,不必讀小字就分得出。
2. **用色溫表達優先序**:移到別天(近、今天要碰、較重要)用暖色;退回本月(晚點、較不重要)用冷色。
3. **就地改狀態**:trail 列的格子點下去能直接改狀態,且選單排除當前狀態。
4. **不動既有直覺**:未完成 / 已完成的格子維持「點一下就切換」,不彈選單。
5. 深色與亮色主題都成立。

## 非目標

- 不改 month / backlog 檢視的列(本次只針對 day trail 列)。
- 不改 trail 列的判定邏輯(`tasksOnDate` 的 `TrailKind` 不動)。
- 不改 trail 文字 label 的文案(仍保留「已移到今天 / 已退回本月」等)。

## 狀態模型

沿用現有 `TrailKind = "primary" | "forwarded" | "dismissed"`。格子外觀與點擊行為依 kind 與完成狀態決定:

| 狀態 | 外觀 | 點擊行為 |
|---|---|---|
| 未完成(primary、`status !== "done"`) | 空方框 | 直接 `toggleDone` |
| 已完成(`status === "done"`) | 綠底勾(`--color-accent`) | 直接 `toggleDone` |
| 移到別天(forwarded) | 方框 + `→`,**暖琥珀** | 開狀態選單 |
| 退回本月(dismissed) | 方框 + `↩`,**冷藍灰** | 開狀態選單 |

要點:

- forwarded / dismissed 的格子**保留 checkbox 的方框外觀**,但角色是選單觸發器,不是 toggle。
- 完成狀態的判定優先於 trail:一個 forwarded 的 task 若被打勾完成,顯示綠勾(已完成),不再顯示 `→`。實務上 trail 列被點完成後就變 done 列。

## 狀態選單

只在 forwarded / dismissed 出現,選項排除當前狀態:

- **forwarded** → `已完成` / `未完成` / `退回本月`
- **dismissed** → `已完成` / `未完成` / `移到今天`

選項對應 store op:

| 選項 | op | 狀態 |
|---|---|---|
| 已完成 | `toggleDone(id)` | 已存在 |
| 未完成(= 取消移走、拉回這天當一般待辦) | `restoreToDay(id, date)` | **新增** |
| 退回本月 | `demoteToMonth(id)` | 已存在 |
| 移到今天 | `moveToToday(id)` | 已存在 |

「未完成」的語意:把這列從 trail 狀態還原成「這天的一般計畫內未完成 task」,亦即讓 `primaryDate(target) === date`(這天)。

## 新 op:`restoreToDay(tasks, id, date)`

放在 `src/store/taskOps.ts`(純函式),並在 `src/store/tasks.ts` 包一層 action(比照 `planScheduleDay`)。

語意:讓 `primaryDate(target)` 成為 `date`,一次涵蓋 forwarded 與 dismissed 兩種來源。

```
restoreToDay(tasks, id, date):
  1. 排定 `date` 為 active primary date,套用與 planScheduleDay 相同的
     append/replace 規則(有 primaryDate 就替換最後一個、否則 append)。
  2. 清掉會擋住 primaryDate === date 的 `unscheduled_at`
     （dismissed 列的 unscheduled_at === date，不清就永遠 primaryDate=null）。
  3. 重啟 `date` 所在月(比照 planScheduleDay 的 month 反填）。
  4. 清 legacy `daily_priority`；`daily_ranks` 保留不動（歷史軌跡）。
```

**為什麼不直接用 `planScheduleDay`**:對 dismissed 列,`planScheduleDay` 只加 date、不清 `unscheduled_at`,`primaryDate` 仍是 null(因為 `last <= unscheduled_at`),列不會回到計畫內。`restoreToDay` 多做「清 `unscheduled_at`」這步。對 forwarded 列(無 `unscheduled_at`),行為與 `planScheduleDay` 等價。

## 顏色 token

在 `src/tokens/colors.css` 的 light 與 dark 各新增一組冷色 `--color-defer-*`(藍灰,hue≈250),結構比照現有的暖色 `--color-carry-*`:

```
/* light */
--color-defer-bg:   oklch(0.93 0.03 250);
--color-defer-edge: oklch(0.72 0.06 250);
--color-defer-text: oklch(0.46 0.09 250);

/* dark */
--color-defer-bg:   oklch(0.28 0.03 245);
--color-defer-edge: oklch(0.5 0.06 245);
--color-defer-text: oklch(0.76 0.06 245);
```

色彩對應:

- **forwarded(暖)** → 現成但目前未被使用的 `--color-carry-*`(琥珀)。
- **dismissed(冷)** → 新增的 `--color-defer-*`(藍灰)。
- **done** → 現有 `--color-accent`(綠)。

上面的 oklch 數值是起點,實際飽和/明度在手動驗收時對著真畫面微調(留一個調整旋鈕,別寫死到不能動)。

## 元件設計

`TaskRow.tsx` 與 `Top3Card.tsx` 的 `Top3Item` **兩處都自己畫 trail 列的 `<Checkbox>`**,為避免走鐘,抽一個共用元件:

- **`StatusCell`**(新檔,`src/features/day/StatusCell.tsx`):輸入 `{ task, kind, date, interactive }`,依狀態決定:
  - primary(open/done)→ 沿用現有 `<Checkbox>`(直接 toggle)。
  - forwarded / dismissed → 方框樣式的選單觸發器 + 對應箭頭與配色,選單 items 由下面的 builder 提供。
- **`buildStatusMenuItems`**(新檔,`src/features/day/statusMenu.ts`):比照 `taskRowMenu.ts`,依 `kind` 產生選單、排除當前狀態,回傳 `MenuItemSpec[]`。
- `useTaskRow` 增加 `restoreToDay` 的呼叫入口(比照現有 `moveToToday` / `demoteToMonth`)。

`TaskRow` 與 `Top3Item` 把原本 trail 分支的 `<Checkbox>` 換成 `<StatusCell>`。非 trail(primary)分支不變。

箭頭符號用 Tabler 或既有字元:`→`(移到別天)、`↩`(退回本月),與 trail label 現有的 `↪` / `↩` 方向一致。

## 測試策略

### 自動化 — 單元(vitest)

捕捉真實行為的 regression,值得測:

- `restoreToDay`:
  - forwarded 輸入(有 primaryDate、無 `unscheduled_at`)→ 結果 `primaryDate === date`,等價 planScheduleDay。
  - dismissed 輸入(`unscheduled_at === date`)→ 結果 `unscheduled_at` 被清、`primaryDate === date`。
  - 目標 date 所在月被重啟(`primaryMonth` 正確)。
- `buildStatusMenuItems`:forwarded 排除「移到今天」、dismissed 排除「退回本月」,兩者都含「已完成 / 未完成」。

（純顏色 token、箭頭字元、label 文案屬字面值,不寫儀式性斷言。）

### 自動化 — e2e(Playwright,`npm run test:e2e`)

依 CLAUDE.md「改 Today 互動要跑 e2e」:

- 點 forwarded 列的格子 → 出現狀態選單;選「未完成」→ 該列回到計畫內未完成樣式。
- 點 dismissed 列的格子 → 選單不含「退回本月」、含「移到今天」。
- open / done 列的格子點一下**直接 toggle,不出現選單**。

### 手動測試(preview + AI agent)

由 AI agent 透過 `preview_start`(共用 profile,已登入就直接驗收,未登入自走 email OTP)實際操作:

- 暖(移到別天)/ 冷(退回本月)兩色在**深色與亮色**主題下都清楚可辨,且與「已完成綠勾」互不混淆。
- 狀態格方框 + 箭頭的視覺重量、選單過場、觸控目標大小。
- 對照下面驗收標準逐項確認。

## 驗收標準

1. 單日檢視中,已完成 / 移到別天 / 退回本月三種列,不讀小字即可從最左格子的顏色與符號分辨。
2. 移到別天為暖色、退回本月為冷色;深色與亮色主題皆成立。
3. 點 forwarded / dismissed 的格子開出狀態選單,且不含當前狀態那一項。
4. 選「未完成」後,該列還原為這天的一般計畫內未完成 task(forwarded 與 dismissed 皆可)。
5. 未完成 / 已完成的格子點一下直接切換完成狀態,不彈選單。
6. `npx vitest run` 與 `npm run test:e2e` 全綠;`npm run build` 型別檢查通過。
