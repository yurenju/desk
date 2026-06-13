# 專注頁逐列 carryover 動作:移到今天 / 丟回月度 設計

## 背景與目標

專注頁(`/focus`、`/focus/$date`)現在可以用日期導航看任何一天。使用者的日常是**每天早上翻到昨天**,看有哪些未完成的任務。目前每一列任務的 `⋯`「更多動作」選單只有「標為計畫外 / 編輯 / 刪除」,沒有把未完成任務「往前帶到今天」或「退回月度」的能力。

本次在既有的逐列 `⋯` 選單加兩個動作:

1. **移到今天**:把這個未完成任務順延到今天(append-only,留軌跡)。
2. **丟回月度**:把它從日層拿掉、退回本月的月度清單,等之後重新規劃。

對應 ROADMAP 的 Slice 5(略過 / unschedule 實寫入)+ Slice 6(carryover 動作)的一個**最小切片** —— 只做這兩條最常用的路徑,其餘留待後續。

## 設計原則

- **不分日期,只看任務相對今天的桶**:動作出現與否、語意,只看任務落在「過去 / 今天 / 未來」哪個桶,不為個別日期特判。所有過去的日子(昨天、前天、上週)共用同一套規則。
- **「移到今天」是主角**:從任何日期都能把任務拉到今天。「移到其他日期」留待之後。
- **append-only,軌跡永不刪**:沿用現有資料模型 —— `scheduled_dates` / `scheduled_months` 只 append、不 remove,`unscheduled_*` 只是標記「目前歸屬」。任務曾排過哪些天的歷史完整保留。

## 範圍

**做:**

- `TaskRow` 的 `⋯` 選單,對「primary 且可互動」的列,加「移到今天」「丟回月度」兩個動作。
- `taskOps` 兩個純函式 + `tasks` store 兩個 action + `useTaskRow` 兩個包裝。
- 把「dismissed」軌跡列的文字由「· 已略過」改成「· 退回月度」(本版 `unscheduled_at` 只由「丟回月度」寫入,語意更準)。

**不做(留後續):**

- 略過(明確放生)。
- 移到「其他日期」(非今天)。
- carryover banner、週導軌逾期提示、月底 review 等**發現性**機制 —— 使用者目前靠自己每天翻昨天,漏掉的之後再處理。
- 排序(`position`)、`is_adhoc` 染色(Slice 7)。

## 名詞與資料模型回顧

- `primaryDate(t)` = `last(scheduled_dates)`,但需 `> (unscheduled_at ?? "")`,否則視為已脫離日層(`null`)。
- `primaryMonth(t)` 同理,對 `scheduled_months` / `unscheduled_month`。
- `tasksOnDate(all, date)` 對每個包含 `date` 的任務判 `kind`:
  - `primary` = `date` 是最後一筆且 `> unscheduled_at`。
  - `dismissed` = `date` 是最後一筆且 `=== unscheduled_at`。
  - `forwarded` = `date` 在陣列裡但不是最後一筆。
- `daily_priority` 是**任務層級**欄位(不綁某天)。因此一個有 `daily_priority` 的任務,只要它在某天是 primary,就自動出現在那天的「三件事」。
- `today` 以 store 的 `today`(載入時設為真實本地日期)為單一真相,不臨場 `todayISO()`。

## 動作出現條件

掛在現有 `⋯` Menu(`src/features/day/TaskRow.tsx`),只在 `editable`(= `interactive && kind === "primary"`)時出現。trail 列(forwarded / dismissed)維持原狀,只能勾完成。

| 動作 | 出現條件 |
| --- | --- |
| 移到今天 | `date !== today`(看的不是今天那天);看今天時不顯示 |
| 丟回月度 | 一律顯示(過去 / 今天 / 未來的 primary 列都可退回月層) |

> `TaskRow` 目前只拿到 `date`,沒有 `today`。新增由 `useTasksStore((s) => s.today)` 在 `TaskRow` 內讀 `today` 來判斷「移到今天」是否顯示。

選單項目順序:**移到今天**(若顯示)→ **丟回月度** → 既有的「標為計畫外 / 編輯 / 刪除」。

## 資料語意

### 移到今天(順延)

純函式 `moveToToday(tasks, id, today)`:

```
target = find(id); if (!target) return tasks
dates = target.custom_fields.scheduled_dates ?? []
if (last(dates) === today) return tasks            // already on today, no-op

nextDates = [...dates, today]                       // append-only

// daily_priority:保留「是否為優先」,但號碼不重要 → 改派到今天不撞號的位置
let nextPriority = target.custom_fields.daily_priority
if (nextPriority) {
  takenByOthers = today 的 primary 任務(排除 id)中已占用的 daily_priority 號碼集合
  if (takenByOthers.size >= 3) nextPriority = undefined   // 今天三件事已滿 → 落到「其他計劃內」
  else nextPriority = nextFreeDailySlot(tasks, today, id) // 取第一個空位(1→2→3)
}

patch(target, { scheduled_dates: nextDates, daily_priority: nextPriority })
```

- 原本那天 → 自動變 `forwarded` 軌跡(`tasksOnDate` 既有邏輯,免改)。
- 今天 → 變 primary。原本是優先就還是優先(占今天一個空位),原本不是就維持落在「其他計劃內 / 臨時加的」。
- **三件事已滿的邊界**(已確認):移過來的優先任務落到「其他計劃內」,**不**擠掉今天刻意挑的三件事;使用者可手動再升它。

store action `moveToToday(id)`:用 `get().today`,套純函式後 `enqueuePatch(id, { scheduled_dates, daily_priority })`,失敗回滾 `prev`(對齊現有 mutation 慣例)。

### 丟回月度(退一層)

純函式 `demoteToMonth(tasks, id, currentMonth)`:

```
target = find(id); if (!target) return tasks
day = primaryDate(target); if (day === null) return tasks   // 不在日層,no-op
months = target.custom_fields.scheduled_months ?? []
nextMonths = primaryMonth(target) === currentMonth ? months : [...months, currentMonth]

patch(target, {
  unscheduled_at: day,          // 脫離日層 → primaryDate 變 null,日欄不再顯示
  scheduled_months: nextMonths, // 確保「本月」是現役月 → 月欄出現
  daily_priority: undefined,    // 已離開日層,日優先序失效
})
```

- `currentMonth` = 今天所在月(`currentMonthISO(today)`),不是任務原本被排的舊月份(已確認)。
- 兩種情況用同一條規則自然分流:
  - **本來就在月度**(`planScheduleDay` 已補本月):`primaryMonth === currentMonth` → 不 push,只寫 `unscheduled_at`。資料近乎不動,只是脫離日層 + 留軌跡。
  - **只加在今天的臨時任務**(`addTodayTask`:`scheduled_dates:[today]`、`is_adhoc:"true"`、無 `scheduled_months`):`primaryMonth === null !== currentMonth` → push 本月,任務**第一次被記進月度**。
- `is_adhoc` **保留不動**:之後 Slice 7「月度欄 adhoc 染紅 chip」可拿它當「臨時插單滲進本月」的提醒。`monthly_priority` 不動。

store action `demoteToMonth(id)`:用 `currentMonthISO(new Date(get().today + "T00:00:00"))`,套純函式後 `enqueuePatch(id, { unscheduled_at, scheduled_months, daily_priority: null })`,失敗回滾 `prev`。

## 軌跡保留

丟回月度後 `scheduled_dates` 不變,只多了 `unscheduled_at`:

- 任務目前所在那天(`day`)= 陣列最後一筆且 `=== unscheduled_at` → 該天渲染為 `dismissed` 軌跡列(文字改為「· 退回月度」)。
- 更早曾排過的天仍是 `forwarded` 軌跡。
- 歷史完整保留,只是不再占用任何現役日。

## 邊界情況

- **同一天先丟回月度、又移到今天**:丟回月度會寫 `unscheduled_at = today`;隨後移到今天 append `today`,但 `last === today === unscheduled_at` → `primaryDate` 仍為 `null`,任務不會回到今天日層。屬罕見的「自我反悔」,本版**不特別處理**,接受此限制(與既有 `planScheduleDay` 對相等日期的處理一致)。
- **未來日丟回月度**:`currentMonth` 仍取今天當月(符合使用者「以今天角度的當月」偏好),即使任務原排在未來月份。
- **移到今天時今天三件事已滿**:見上,落到「其他計劃內」。

## 受影響檔案

**修改:**

- `src/store/taskOps.ts`:新增純函式 `moveToToday`、`demoteToMonth`。
- `src/store/tasks.ts`:`TasksState` 介面 + 實作新增 `moveToToday(id)`、`demoteToMonth(id)` 兩個 action。
- `src/features/day/useTaskRow.ts`:新增 `moveToToday`、`demoteToMonth` 包裝。
- `src/features/day/TaskRow.tsx`:讀 `today`;`⋯` Menu 條件式加兩個 item;`dismissed` 軌跡文字改「· 退回月度」。

**測試(新增 / 修改):**

- `src/store/taskOps.test.ts`:`moveToToday`、`demoteToMonth` 各情境(含撞號、三件事滿、臨時任務補月、本來在月度的 no-op-ish、軌跡保留)。
- `src/features/day/TaskRow` 測試:`date !== today` 時出現「移到今天」、`date === today` 時不出現;「丟回月度」恆在;點擊呼叫對應 store action。
- e2e(`e2e/*.spec.ts`):翻到昨天 → 移到今天 → 切到今天看到它、昨天剩軌跡;某列丟回月度 → 日欄消失、月欄出現、原日成「退回月度」軌跡。
- 測試檔顯式 `import { describe, it, expect } from "vitest"`。

## 測試策略

### 單元 / 元件測試(vitest + Testing Library)

- `taskOps`:純函式逐情境(如上)。
- `TaskRow`:選單項目隨 `date` / `today` 出現與隱藏;點擊觸發正確 action。

### e2e(Playwright,`npm run test:e2e`)

依 CLAUDE.md:改到專注頁互動必跑 e2e。涵蓋:

- 翻到昨天,某未完成任務 `⋯` → 移到今天 → URL/視圖切到今天時它在(原本是優先 → 在三件事;否則在其他);回昨天那列為「↪ 已順延」軌跡。
- 某 primary 列 `⋯` → 丟回月度 → 該列從日欄消失,月度欄(`MonthDigest` / Plan)出現該任務,原日渲染「· 退回月度」軌跡。
- 只加在今天的臨時任務,丟回月度後在本月月度清單出現。

### 手動測試(preview + AI agent)

- 由 AI agent 用 `preview_start` + 共用 profile 開預覽(先探測登入狀態,已登入直接驗收)。
- 翻到昨天,實際點 `⋯` 跑「移到今天 / 丟回月度」,確認:任務在日 / 月之間移動、軌跡列文字、三件事保留與滿位落點、selectedDate 不是昨天(前天 / 未來)時行為一致。
- 看選單觀感、觸控目標、鍵盤可達。

## 驗收標準

1. 在非今天的日視圖,primary 未完成任務的 `⋯` 有「移到今天」;看今天時不顯示。
2. 「丟回月度」在 primary 列恆顯示(過去 / 今天 / 未來)。
3. 移到今天:任務出現在今天;原本有 `daily_priority` 的進三件事(不撞號;今天滿則落「其他計劃內」);原本沒有的落「其他計劃內 / 臨時加的」;原日變 `forwarded` 軌跡。
4. 丟回月度:任務離開日欄、進本月月度清單;只加在今天的臨時任務此時首次被記進月度;原日變「· 退回月度」軌跡,`scheduled_dates` 歷史不丟。
5. `npm run build`(型別)綠、`npx vitest run` 綠、`npm run test:e2e` 綠。
