# 專注頁日期導航 + route 改名設計

## 背景與目標

專注頁（ModeToggle 的「專注」，目前 route `/today`）左欄是 `WeekRail`、手機底部是 `DayChip`，目前**只顯示、不能點**。route `/today/$date` 其實已經存在，但沒有任何 UI 入口讓使用者切換到別天。

本次要做兩件事：

1. **日期導航**：讓 `WeekRail` 的七天、`DayChip` 都可點，並加上「上一週 / 下一週 / 回今天」控制，讓使用者能在不同日期間導航。
2. **route 改名**：`/today` → `/focus`，對齊 ModeToggle 的 label「專注」。改名後語意是「專注於某一天」，而非綁定「今天」。`/plan` 不變。

## 設計原則：route 為單一真相來源

維持專案既有架構：**所有狀態都從 route param `selectedDate` 衍生**，不引入額外的「目前顯示週」local state。WeekRail 顯示哪一週、哪一天 highlight、中間欄顯示哪天，全部跟著 URL 走。

三種導航操作全部轉成「導航到某個 `/focus/$date`」：

| 操作 | 目標 route |
| --- | --- |
| 點某一天 | `/focus/{該日}` |
| 上一週 | `/focus/{addDays(selectedDate, -7)}` |
| 下一週 | `/focus/{addDays(selectedDate, +7)}` |
| 回今天 | `/focus/{today}`（用 store 傳進來的 `today`，對齊 rail 裡 highlight 的「今天」） |

翻週會落在**相鄰週的同一個 weekday**，並同時改變 `selectedDate`（選到那一天）→ 中間欄內容也跟著更新。這是刻意的，符合 route-as-source-of-truth，使用者已確認此行為。

## route 改名（/today → /focus）

route 檔改名（TanStack Router file-based routing，檔名即 route）：

- `src/routes/today.tsx` → `src/routes/focus.tsx`
- `src/routes/today.index.tsx` → `src/routes/focus.index.tsx`
- `src/routes/today.$date.tsx` → `src/routes/focus.$date.tsx`

`createFileRoute("/today...")` 內的路徑字串一併改成 `/focus...`。redirect 目標、navigate 目標一併改：

- `src/routes/index.tsx`：`redirect({ to: "/today" })` → `/focus`
- `src/routes/login.tsx`：`navigate({ to: "/today" })` → `/focus`
- `src/features/shell/ModeToggle.tsx`：`to: "/today"` → `/focus`；`current` 判定改看 `pathname.startsWith("/focus")`

`src/routeTree.gen.ts` 由 TanStack Router plugin 自動重新產生，不手改。

> 註：元件內部名稱（`TodayView`、`TodayLayout`、`TodayLayoutProps` 等）與檔案 `TodayLayout.tsx` **不在本次改名範圍**。本次只改「route 路徑」這層語意；元件改名屬無關重構，YAGNI 跳過，避免擴大 diff。

## WeekRail（桌機左欄）

`src/features/week/WeekRail.tsx`：

- header 區加一排控制：`‹`（上一週）、`回今天`、`›`（下一週）。
  - `回今天` 只在 `selectedDate !== today` 時 render。
  - 三個都用 TanStack Router 的 `<Link>`（不需 `useNavigate`），`to="/focus/$date"` + `params`。
- 七天每個 `<li>` 的內容改成 `<Link to="/focus/$date" params={{ date }}>`：
  - 保留現有 `selected` / `today` 樣式。
  - 加 hover / focus-visible 樣式（鍵盤可達）。
  - selected 那天加 `aria-current="page"`。
- WeekRail 仍是 presentational：props（`allTasks` / `selectedDate` / `today`）不變，只是內部改用 `<Link>`。翻週/回今天的目標日由 `addDays` / `today` 算出。

對應 CSS（`WeekRail.module.css`）加 hover/focus 樣式、控制列排版；Link 需 reset 預設 anchor 樣式（顏色、底線）。

## DayChip（手機底部）

`src/features/week/DayChip.tsx`：

- 整個 chip 包成 `<Link to="/focus/$date" params={{ date }}>`，行為與桌機一致（保留 selected / today 樣式、加 focus-visible、selected 加 `aria-current`）。
- `TodayLayout` 的 `mobileChips` 容器（`src/features/plan-view/TodayLayout.tsx`）兩端加 `‹` / `›` 翻週小按鈕（同樣是 `<Link>`，目標 `addDays(selectedDate, ∓7)`），維持手機也能跨週。

> `DayChip` 目前無翻週能力，翻週按鈕放在 `TodayLayout` 的 chips 列容器、而非 `DayChip` 內，因為 `DayChip` 是「單一天」的元件、不該知道整週。

## 受影響檔案清單

**改名 / 修改：**

- `src/routes/today.tsx` → `focus.tsx`（route 路徑字串改 `/focus`）
- `src/routes/today.index.tsx` → `focus.index.tsx`
- `src/routes/today.$date.tsx` → `focus.$date.tsx`（redirect 目標改 `/focus`）
- `src/routes/index.tsx`（redirect → `/focus`）
- `src/routes/login.tsx`（navigate → `/focus`）
- `src/features/shell/ModeToggle.tsx`（route 與 `current` 判定）
- `src/features/week/WeekRail.tsx`（Link 化 + 控制列）
- `src/features/week/WeekRail.module.css`（hover/focus/控制列樣式）
- `src/features/week/DayChip.tsx`（Link 化）
- `src/features/week/DayChip.module.css`（focus 樣式、anchor reset）
- `src/features/plan-view/TodayLayout.tsx`（mobileChips 加翻週按鈕）

**測試（改名 + 新增）：**

- `src/routes/-today.test.tsx`、`src/routes/-today-date-route.test.tsx`：route 路徑改 `/focus`，檔名可一併改 `-focus*`。
- `src/features/week/WeekColumn.test.tsx`：確認不受影響（WeekColumn 屬 plan 側）。
- 新增 WeekRail / DayChip 的 Link 行為測試（見下）。
- e2e：`e2e/fixtures/session.ts:15` 的 `page.goto("/today")` → `/focus`；新增專注頁導航 e2e。

**自動產生（不手改）：**

- `src/routeTree.gen.ts`

## 測試策略

### 單元 / 元件測試（vitest + Testing Library）

- `WeekRail`：
  - 七天各自 render 成 `<a>`，`href` 指向 `/focus/{該日}`。
  - 翻上一週 / 下一週按鈕 `href` = `/focus/{selectedDate ∓7}`。
  - `回今天`：`selectedDate !== today` 時出現且 `href` = `/focus/{today}`；`selectedDate === today` 時不 render。
  - selected 那天有 `aria-current="page"`。
- `DayChip`：render 成 `<a>`、`href` 正確、selected 有 `aria-current`。
- route 測試：`/focus`、`/focus/$date`、不合法 date 會 redirect 回 `/focus`。

> 測試檔需顯式 `import { describe, it, expect } from "vitest"`（本專案 `tsc -b` 會檢查測試檔，不靠 global）。

### e2e（Playwright，`npm run test:e2e`）

依 CLAUDE.md：改到專注頁互動必跑 e2e。新增 spec：

- 點 WeekRail 某天 → URL 變 `/focus/$date`，中間欄（DayColumn hero）換成該天內容。
- 點下一週 → URL = 下週同 weekday，WeekRail highlight 與 header WEEK 編號更新。
- 點上一週 → 對稱驗證。
- selectedDate 非今天時點「回今天」→ 回到 `/focus/{today}`，「回今天」消失。
- 既有 `session.ts` 的 `/today` → `/focus` 後，原本的 plan e2e 仍綠。

### 手動測試（preview + AI agent）

- 由 AI agent 用 `preview_start` + 共用 profile 開預覽（先探測登入狀態，已登入直接驗收）。
- 實際點選七天、翻上/下週、回今天，確認 URL、highlight、中間欄同步。
- 看 hover / focus-visible 觀感、鍵盤 Tab 能否走到每一天與控制鈕。
- 縮到手機寬度，驗證底部 chip 可點 + 翻週按鈕排版正常。

## 驗收標準

1. route `/today` 全面改為 `/focus`；舊 `/today` 不再存在，`/`、login、ModeToggle 都導向 `/focus`。
2. 桌機 WeekRail 七天可點，點了切到 `/focus/{該日}`，中間欄換成該天。
3. WeekRail 有「上一週 / 下一週」可翻週（落相鄰週同 weekday），URL 與 highlight 同步更新。
4. selectedDate 非今天時出現「回今天」，點了回到今天；等於今天時不顯示。
5. 手機底部 chip 可點、且有翻週按鈕，行為與桌機一致。
6. 每一天與控制鈕皆為真正的 `<a>`（鍵盤可達、有 focus 樣式），selected 有 `aria-current`。
7. `npm run build`（型別）綠、`npx vitest run` 綠、`npm run test:e2e` 綠。
