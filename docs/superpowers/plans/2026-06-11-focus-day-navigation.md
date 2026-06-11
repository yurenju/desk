# 專注頁日期導航 + route 改名 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓專注頁的 WeekRail 七天與手機 DayChip 可點以導航到不同日期、加上上/下週與回今天控制，並把 `/today` route 改名為 `/focus`。

**Architecture:** 維持「route 為單一真相來源」——所有導航都轉成導向某個 `/focus/$date`，不引入額外的「顯示週」state。先做機械式 route 改名（保持全綠），再把 WeekRail / DayChip 的 `<li>` / `<div>` 換成 TanStack Router 的 `<Link>`，最後補 e2e 與手動驗收。

**Tech Stack:** React 19、TanStack Router（file-based routing）、CSS Modules、Vitest + Testing Library、Playwright。

對應 spec：[2026-06-11-focus-day-navigation-design.md](../specs/2026-06-11-focus-day-navigation-design.md)

---

## 任務 1：route 改名 `/today` → `/focus`

純機械式改名，元件內部名稱（`TodayView` / `TodayLayout`）刻意不動，只改「route 路徑」這層。`src/routeTree.gen.ts` 由 router plugin 自動重生，不手改。

**檔案：**

- 改名：`src/routes/today.tsx` → `src/routes/focus.tsx`
- 改名：`src/routes/today.index.tsx` → `src/routes/focus.index.tsx`
- 改名：`src/routes/today.$date.tsx` → `src/routes/focus.$date.tsx`
- 修改：`src/routes/index.tsx`、`src/routes/login.tsx`、`src/features/shell/ModeToggle.tsx`
- 改名 + 修改（測試）：`src/routes/-today.test.tsx` → `-focus.test.tsx`、`src/routes/-today-date-route.test.tsx` → `-focus-date-route.test.tsx`
- 修改（e2e）：`e2e/fixtures/session.ts`
- 自動重生（不手改）：`src/routeTree.gen.ts`

- [ ] **Step 1：用 git mv 改名三個 route 檔與兩個 route 測試檔**

```bash
git mv src/routes/today.tsx src/routes/focus.tsx
git mv src/routes/today.index.tsx src/routes/focus.index.tsx
git mv "src/routes/today.\$date.tsx" "src/routes/focus.\$date.tsx"
git mv src/routes/-today.test.tsx src/routes/-focus.test.tsx
git mv src/routes/-today-date-route.test.tsx src/routes/-focus-date-route.test.tsx
```

（PowerShell 下 `$date` 不需跳脫：`git mv src/routes/today.$date.tsx src/routes/focus.$date.tsx`。）

- [ ] **Step 2：改 `src/routes/focus.tsx` 內的 route 路徑字串**

把 `createFileRoute("/today")` 改成 `createFileRoute("/focus")`。其餘（`TodayView` / `TodayLayoutRoute` 名稱、import）不動。最終該行為：

```tsx
export const Route = createFileRoute("/focus")({
  component: TodayLayoutRoute,
});
```

- [ ] **Step 3：改 `src/routes/focus.$date.tsx`**

改 route 路徑、redirect 目標、以及對同目錄的 import（檔案已改名為 `focus.tsx`）。完整檔案：

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { isValidDateParam } from "@/lib/date";
import { TodayView } from "./focus";

function TodayDateRoute() {
  const { date } = Route.useParams();
  return <TodayView date={date} />;
}

export const Route = createFileRoute("/focus/$date")({
  beforeLoad: ({ params }) => {
    if (!isValidDateParam(params.date)) throw redirect({ to: "/focus" });
  },
  component: TodayDateRoute,
});
```

- [ ] **Step 4：改 `src/routes/focus.index.tsx`**

完整檔案：

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { todayISO } from "@/lib/date";
import { TodayView } from "./focus";

function TodayIndexRoute() {
  return <TodayView date={todayISO()} />;
}

export const Route = createFileRoute("/focus/")({
  component: TodayIndexRoute,
});
```

- [ ] **Step 5：改 `src/routes/index.tsx` 的 redirect 目標**

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/focus" });
  },
});
```

- [ ] **Step 6：改 `src/routes/login.tsx` 的 navigate 目標**

把 `navigate({ to: "/today" })` 改成 `navigate({ to: "/focus" })`（該檔只有這一處 `/today`，第 17 行附近）。

- [ ] **Step 7：改 `src/features/shell/ModeToggle.tsx`**

route 與 mode 判定都對齊 `/focus`。完整檔案：

```tsx
import { useLocation, useNavigate } from "@tanstack/react-router";
import { SegmentedControl } from "@/ui/SegmentedControl";

type Mode = "plan" | "focus";

export function ModeToggle() {
  const navigate = useNavigate();
  const location = useLocation();
  const current: Mode = location.pathname.startsWith("/plan") ? "plan" : "focus";

  return (
    <SegmentedControl<Mode>
      value={current}
      onValueChange={(v) => navigate({ to: v === "plan" ? "/plan" : "/focus" })}
      ariaLabel="Mode"
      options={[
        { value: "plan", label: "規劃" },
        { value: "focus", label: "專注" },
      ]}
    />
  );
}
```

- [ ] **Step 8：改兩個 route 測試檔的 import 與路徑**

`src/routes/-focus.test.tsx`：把 `import { TodayView } from "./today";` 改成 `from "./focus";`（其餘不動，該檔用的是 `<TodayView date=... />`，無 `/today` 字串）。

`src/routes/-focus-date-route.test.tsx`：把測試敘述與 `initialEntries` 的 `/today/2026-05-30` 改成 `/focus/2026-05-30`，redirect 註解一併改。關鍵兩行：

```tsx
it("renders the /focus/$date child route — $date param reaches the view", async () => {
```
```tsx
    history: createMemoryHistory({ initialEntries: ["/focus/2026-05-30"] }),
```

- [ ] **Step 9：改 `e2e/fixtures/session.ts`**

把第 15 行 `await page.goto("/today");` 改成 `await page.goto("/focus");`，並把上方註解的 `/today` 字樣改成 `/focus`（function 名 `gotoTodaySeeded` 保留，避免擴大改動）。

- [ ] **Step 10：重生 routeTree.gen.ts（跑一次 vite）**

router plugin 在 vite 啟動/build 時才會重寫 `src/routeTree.gen.ts`。`npm run build` 會先跑 `tsc -b`，此時舊的 gen tree 仍 import 已刪除的 `./routes/today` → 型別錯。所以先單獨跑一次 `vite build` 讓 plugin 重生 gen tree：

Run: `npx vite build`
Expected: 成功；過程中 `src/routeTree.gen.ts` 被改寫。

驗證 gen tree 已指向 focus：

Run: `git diff --stat src/routeTree.gen.ts`（應顯示有變動）
再 grep 確認：搜 `src/routeTree.gen.ts` 內含 `/focus`、不再含 `routes/today`。

- [ ] **Step 11：型別檢查（`npm run build`）**

Run: `npm run build`
Expected: PASS（`tsc -b` 綠、`vite build` 綠）。若 `tsc -b` 報找不到 `./routes/today`，表示 Step 10 的 gen tree 沒重生成功，回去重跑 `npx vite build`。

- [ ] **Step 12：跑單元測試**

Run: `npx vitest run`
Expected: PASS（route 測試現在跑 `/focus/$date`）。

- [ ] **Step 13：commit**

```bash
git add -A
git commit -m "refactor(routes): rename /today to /focus"
```

---

## 任務 2：WeekRail 七天可點 + 上/下週 + 回今天

把 WeekRail 的根節點改成 `<nav aria-label="週導覽">`、每一天包成 `<Link to="/focus/$date">`，header 加上一週/下一週/回今天控制。範本沿用 plan 側的 `WeekColumn.tsx`（同樣的 `Link` + `aria-label="切到 …"` + `aria-current="date"` + `addDays`）。

**檔案：**

- 修改：`src/features/week/WeekRail.tsx`
- 修改：`src/features/week/WeekRail.module.css`
- 新增：`src/features/week/WeekRail.test.tsx`

- [ ] **Step 1：先寫失敗測試 `src/features/week/WeekRail.test.tsx`**

透過完整 router 渲染 `/focus/$date`（WeekRail 在該頁的 layout 內），用 `週導覽` nav landmark scope，避免和手機 chip 的同名 link 撞名。`2026-06-11` 是週四，其週為 `2026-06-07`（日）～`2026-06-13`（六）。

```tsx
import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { RouterProvider, createRouter, createMemoryHistory } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { useTasksStore } from "@/store/tasks";

const TODAY = "2026-06-11";

function renderAt(path: string, today = TODAY) {
  useTasksStore.setState({ tasks: [], today, status: "ready", error: null });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(<RouterProvider router={router} />);
}

async function rail() {
  return (await screen.findByRole("navigation", { name: "週導覽" })) as HTMLElement;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));
});

it("links each day in the week to /focus/$date", async () => {
  renderAt("/focus/2026-06-10");
  const r = await rail();
  expect(within(r).getByRole("link", { name: "切到 2026-06-09" }).getAttribute("href")).toBe(
    "/focus/2026-06-09",
  );
});

it("marks the selected day with aria-current=date", async () => {
  renderAt("/focus/2026-06-10");
  const r = await rail();
  expect(within(r).getByRole("link", { name: "切到 2026-06-10" }).getAttribute("aria-current")).toBe(
    "date",
  );
});

it("prev/next week links shift the selected date by 7 days", async () => {
  renderAt("/focus/2026-06-10");
  const r = await rail();
  expect(within(r).getByRole("link", { name: "上一週" }).getAttribute("href")).toBe(
    "/focus/2026-06-03",
  );
  expect(within(r).getByRole("link", { name: "下一週" }).getAttribute("href")).toBe(
    "/focus/2026-06-17",
  );
});

it("shows 回今天 pointing at today when viewing another day", async () => {
  renderAt("/focus/2026-06-10");
  const r = await rail();
  expect(within(r).getByRole("link", { name: "回今天" }).getAttribute("href")).toBe(
    "/focus/2026-06-11",
  );
});

it("hides 回今天 when viewing today", async () => {
  renderAt("/focus/2026-06-11");
  const r = await rail();
  expect(within(r).queryByRole("link", { name: "回今天" })).toBeNull();
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/features/week/WeekRail.test.tsx`
Expected: FAIL（目前 WeekRail 是 `<aside>` 無 `週導覽` landmark、也沒有 link）。

- [ ] **Step 3：改寫 `src/features/week/WeekRail.tsx`**

完整檔案：

```tsx
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { Task } from "@/lib/types";
import { tasksOnDate } from "@/lib/tasks";
import { weekOf, shortWeekday, dayOfMonth, isoWeek, addDays } from "@/lib/date";
import styles from "./WeekRail.module.css";

export interface WeekRailProps {
  allTasks: Task[];
  selectedDate: string;
  today: string;
}

export function WeekRail({ allTasks, selectedDate, today }: WeekRailProps) {
  const week = useMemo(() => weekOf(selectedDate), [selectedDate]);

  return (
    <nav className={styles.rail} aria-label="週導覽">
      <header className={styles.head}>
        <div className={styles.eyebrow}>WEEK {isoWeek(selectedDate)}</div>
        <div className={styles.nav}>
          <Link
            to="/focus/$date"
            params={{ date: addDays(selectedDate, -7) }}
            className={styles.step}
            aria-label="上一週"
          >
            ‹
          </Link>
          <div className={styles.range}>
            {dayOfMonth(week[0])}/{Number(week[0].slice(5, 7))} – {dayOfMonth(week[6])}/
            {Number(week[6].slice(5, 7))}
          </div>
          <Link
            to="/focus/$date"
            params={{ date: addDays(selectedDate, 7) }}
            className={styles.step}
            aria-label="下一週"
          >
            ›
          </Link>
        </div>
        {selectedDate !== today && (
          <Link to="/focus/$date" params={{ date: today }} className={styles.todayLink}>
            回今天
          </Link>
        )}
      </header>

      <ul className={styles.list}>
        {week.map((date) => {
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const entries = tasksOnDate(allTasks, date);
          const primary = entries.filter((e) => e.kind === "primary");
          const top3 = primary
            .filter((e) => e.task.custom_fields.daily_priority)
            .sort(
              (a, b) =>
                Number(a.task.custom_fields.daily_priority) -
                Number(b.task.custom_fields.daily_priority),
            )
            .slice(0, 3);
          return (
            <li key={date} className={styles.dayItem}>
              <Link
                to="/focus/$date"
                params={{ date }}
                aria-label={`切到 ${date}`}
                aria-current={isSelected ? "date" : undefined}
                className={[styles.day, isSelected && styles.selected, isToday && styles.today]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className={styles.dayHeader}>
                  <span className={styles.num}>{dayOfMonth(date)}</span>
                  <span className={styles.wk}>{shortWeekday(date).toUpperCase()}</span>
                  {isToday && <span className={styles.todayTag}>今天</span>}
                </div>
                <ul className={styles.tasks}>
                  {top3.map((e) => (
                    <li
                      key={e.task.id}
                      className={[styles.task, e.task.status === "done" && styles.done]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {e.task.title}
                    </li>
                  ))}
                </ul>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4：更新 `src/features/week/WeekRail.module.css`**

`.day` 從原本套在 `<li>` 改成套在 `<Link>`，要加 anchor reset、hover、focus-visible；新增 `.dayItem` / `.nav` / `.step` / `.todayLink`。把原本的 `.day` 與 `.day.selected` 兩個區塊（檔案第 37–43 行）替換成：

```css
.dayItem {
  list-style: none;
}

.day {
  display: block;
  text-decoration: none;
  color: inherit;
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
  border-left: 2px solid transparent;
  border-radius: var(--radius-sm);
}
.day:hover {
  background: var(--color-paper-alt);
}
.day:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.day.selected {
  border-left-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.nav {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.step {
  text-decoration: none;
  color: var(--color-ink-faint);
  font-size: var(--text-lg);
  padding: 0 var(--space-1);
  border-radius: 5px;
}
.step:hover {
  background: var(--color-paper-alt);
  color: var(--color-ink);
}

.todayLink {
  align-self: flex-start;
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  letter-spacing: 0.04em;
  color: var(--color-accent-text);
  text-decoration: none;
}
.todayLink:hover {
  text-decoration: underline;
}
```

- [ ] **Step 5：跑測試確認通過**

Run: `npx vitest run src/features/week/WeekRail.test.tsx`
Expected: PASS（5 個 it 全綠）。

- [ ] **Step 6：型別檢查**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 7：commit**

```bash
git add src/features/week/WeekRail.tsx src/features/week/WeekRail.module.css src/features/week/WeekRail.test.tsx
git commit -m "feat(focus): make WeekRail days clickable with week nav"
```

---

## 任務 3：DayChip 可點 + 手機翻週按鈕

DayChip 包成 `<Link>`；翻週的 `‹`/`›` 放在 `TodayLayout` 的 chips 容器（因為 DayChip 是「單一天」、不該知道整週），並把容器改成 `<nav aria-label="日期切換">`。

**檔案：**

- 修改：`src/features/week/DayChip.tsx`
- 修改：`src/features/week/DayChip.module.css`
- 修改：`src/features/plan-view/TodayLayout.tsx`
- 修改：`src/features/plan-view/TodayLayout.module.css`
- 新增：`src/features/week/DayChip.test.tsx`

- [ ] **Step 1：先寫失敗測試 `src/features/week/DayChip.test.tsx`**

```tsx
import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { RouterProvider, createRouter, createMemoryHistory } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { useTasksStore } from "@/store/tasks";

const TODAY = "2026-06-11";

function renderAt(path: string, today = TODAY) {
  useTasksStore.setState({ tasks: [], today, status: "ready", error: null });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(<RouterProvider router={router} />);
}

async function chips() {
  return (await screen.findByRole("navigation", { name: "日期切換" })) as HTMLElement;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));
});

it("links each chip to /focus/$date with aria-current on the selected day", async () => {
  renderAt("/focus/2026-06-10");
  const nav = await chips();
  const link = within(nav).getByRole("link", { name: "切到 2026-06-10" });
  expect(link.getAttribute("href")).toBe("/focus/2026-06-10");
  expect(link.getAttribute("aria-current")).toBe("date");
});

it("mobile week nav shifts the selected date by 7 days", async () => {
  renderAt("/focus/2026-06-10");
  const nav = await chips();
  expect(within(nav).getByRole("link", { name: "上一週" }).getAttribute("href")).toBe(
    "/focus/2026-06-03",
  );
  expect(within(nav).getByRole("link", { name: "下一週" }).getAttribute("href")).toBe(
    "/focus/2026-06-17",
  );
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/features/week/DayChip.test.tsx`
Expected: FAIL（目前 chips 容器是 `<div>` 無 `日期切換` landmark、chip 不是 link、無翻週按鈕）。

- [ ] **Step 3：改寫 `src/features/week/DayChip.tsx`**

完整檔案：

```tsx
import { Link } from "@tanstack/react-router";
import type { Task } from "@/lib/types";
import { tasksOnDate } from "@/lib/tasks";
import { dayOfMonth, shortWeekday } from "@/lib/date";
import styles from "./DayChip.module.css";

export interface DayChipProps {
  date: string;
  today: string;
  selected: boolean;
  allTasks: Task[];
}

export function DayChip({ date, today, selected, allTasks }: DayChipProps) {
  const count = tasksOnDate(allTasks, date).filter((e) => e.kind === "primary").length;
  const isToday = date === today;
  return (
    <Link
      to="/focus/$date"
      params={{ date }}
      aria-label={`切到 ${date}`}
      aria-current={selected ? "date" : undefined}
      className={[styles.chip, selected && styles.selected, isToday && styles.today]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.wk}>{shortWeekday(date).toUpperCase()}</div>
      <div className={styles.num}>{dayOfMonth(date)}</div>
      <div className={styles.count}>{count} 件</div>
    </Link>
  );
}
```

- [ ] **Step 4：更新 `src/features/week/DayChip.module.css`**

把 `.chip` 區塊（檔案第 1–12 行）替換成下面版本（加上 anchor reset 與 focus-visible），其餘 class 不動：

```css
.chip {
  width: 56px;
  flex-shrink: 0;
  background: var(--color-paper);
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-sm);
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-decoration: none;
  color: inherit;
}
.chip:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 5：改 `src/features/plan-view/TodayLayout.tsx`**

加 `Link` / `addDays` import，把 `mobileChips` 的 `<div>` 換成 `<nav aria-label="日期切換">` 並在兩端加翻週 link。完整檔案：

```tsx
import { Link } from "@tanstack/react-router";
import type { Task } from "@/lib/types";
import { CarryoverBanner } from "@/features/carryover/CarryoverBanner";
import { WeekRail } from "@/features/week/WeekRail";
import { DayColumn } from "@/features/day/DayColumn";
import { MonthDigest } from "@/features/month/MonthDigest";
import { DayChip } from "@/features/week/DayChip";
import { weekOf, addDays } from "@/lib/date";
import { MOCK_CARRYOVER_DAY } from "@/mock/data";
import { DeleteUndoToast } from "@/features/day/DeleteUndoToast";
import styles from "./TodayLayout.module.css";

export interface TodayLayoutProps {
  allTasks: Task[];
  selectedDate: string;
  today: string;
  month: string;
}

export function TodayLayout({ allTasks, selectedDate, today, month }: TodayLayoutProps) {
  const week = weekOf(selectedDate);

  return (
    <main className={styles.page}>
      <CarryoverBanner
        fromLabel="從昨天延續"
        summary={`${MOCK_CARRYOVER_DAY.fromDate.slice(5)}(四)有 ${MOCK_CARRYOVER_DAY.count} 件沒做完`}
        count={MOCK_CARRYOVER_DAY.count}
        actions={["→ 三件事", "→ 計劃內", "略過"]}
      />

      <div className={styles.grid}>
        <aside className={[styles.cell, styles.left].join(" ")}>
          <WeekRail allTasks={allTasks} selectedDate={selectedDate} today={today} />
        </aside>
        <section className={[styles.cell, styles.center].join(" ")}>
          <DayColumn allTasks={allTasks} selectedDate={selectedDate} variant="today-hero" />
        </section>
        <aside className={[styles.cell, styles.right].join(" ")}>
          <MonthDigest allTasks={allTasks} month={month} today={today} />
        </aside>
      </div>

      <nav className={styles.mobileChips} aria-label="日期切換">
        <Link
          to="/focus/$date"
          params={{ date: addDays(selectedDate, -7) }}
          className={styles.chipStep}
          aria-label="上一週"
        >
          ‹
        </Link>
        {week.map((date) => (
          <DayChip
            key={date}
            date={date}
            today={today}
            selected={date === selectedDate}
            allTasks={allTasks}
          />
        ))}
        <Link
          to="/focus/$date"
          params={{ date: addDays(selectedDate, 7) }}
          className={styles.chipStep}
          aria-label="下一週"
        >
          ›
        </Link>
      </nav>

      <DeleteUndoToast />
    </main>
  );
}
```

- [ ] **Step 6：更新 `src/features/plan-view/TodayLayout.module.css`**

在 `.mobileChips`（在 `@media (max-width: 767px)` 內）後面新增 `.chipStep`。在檔案最末（`@media` 區塊內、`.mobileChips { … }` 之後）加：

```css
  .chipStep {
    flex-shrink: 0;
    align-self: stretch;
    display: flex;
    align-items: center;
    padding: 0 var(--space-2);
    text-decoration: none;
    color: var(--color-ink-faint);
    font-size: var(--text-lg);
  }
```

- [ ] **Step 7：跑測試確認通過**

Run: `npx vitest run src/features/week/DayChip.test.tsx`
Expected: PASS。

- [ ] **Step 8：跑全部單元測試 + 型別檢查**

Run: `npx vitest run`
Expected: PASS。

Run: `npm run build`
Expected: PASS。

- [ ] **Step 9：commit**

```bash
git add src/features/week/DayChip.tsx src/features/week/DayChip.module.css src/features/week/DayChip.test.tsx src/features/plan-view/TodayLayout.tsx src/features/plan-view/TodayLayout.module.css
git commit -m "feat(focus): make mobile DayChips clickable with week nav"
```

---

## 任務 4：e2e 導航測試

對真實 BFF + mock WSPC 驗證導航。fake WSPC 的種子是以「reset 當下的今天」計算，所以 e2e 不硬編日期，改驗相對行為（URL 變成某個 `/focus/YYYY-MM-DD`、回今天回到 hero、點某天後該天 `aria-current=date`）。

**檔案：**

- 新增：`e2e/focus-navigation.spec.ts`

- [ ] **Step 1：寫 `e2e/focus-navigation.spec.ts`**

```ts
import { test, expect } from "@playwright/test";
import { gotoTodaySeeded } from "./fixtures/session";

test("next/prev week navigates the focus view, back-to-today returns", async ({ page }) => {
  await gotoTodaySeeded(page);
  const rail = page.getByRole("navigation", { name: "週導覽" });

  await rail.getByRole("link", { name: "下一週" }).click();
  await expect(page).toHaveURL(/\/focus\/\d{4}-\d{2}-\d{2}$/);

  await rail.getByRole("link", { name: "回今天" }).click();
  await expect(page.getByText("今天最重要的三件事")).toBeVisible();
});

test("clicking a day in the week rail switches the focused day", async ({ page }) => {
  await gotoTodaySeeded(page);
  const rail = page.getByRole("navigation", { name: "週導覽" });

  const firstDay = rail.getByRole("link", { name: /^切到 \d{4}-\d{2}-\d{2}$/ }).first();
  const label = await firstDay.getAttribute("aria-label");
  const date = label!.replace("切到 ", "");

  await firstDay.click();
  await expect(page).toHaveURL(new RegExp(`/focus/${date}$`));
  await expect(rail.getByRole("link", { name: `切到 ${date}` })).toHaveAttribute(
    "aria-current",
    "date",
  );
});
```

- [ ] **Step 2：跑 e2e**

Run: `npm run test:e2e`
Expected: PASS（含既有 plan-interaction spec，確認 `/today`→`/focus` 改名沒打到別的）。

> 跑 e2e 前先確認沒有別的 worktree dev server 在跑（會搶 KV session）。e2e server 由 `playwright.config.ts` 自動起在 `127.0.0.1`。

- [ ] **Step 3：commit**

```bash
git add e2e/focus-navigation.spec.ts
git commit -m "test(e2e): focus-page day navigation"
```

---

## 任務 5：手動驗收 + 產生驗收報告

依 [.claude/rules/acceptance-report.md](../../.claude/rules/acceptance-report.md)，全程用 `playwright-cli` 對真實 WSPC 實機驗收，報告寫到 gitignored 的 `docs/acceptance-reports/2026-06-11-focus-day-navigation/`。

**檔案（gitignored，不進版控）：**

- 新增：`docs/acceptance-reports/2026-06-11-focus-day-navigation/report.md`
- 新增：`docs/acceptance-reports/2026-06-11-focus-day-navigation/assets/*.png`

- [ ] **Step 1：起 dev server 並用共用 profile 開預覽**

依 CLAUDE.md「本機 preview 登入」：用共用 KV + 共用 playwright profile，一次 device flow 可撐 30 天。

```bash
npm run dev -- --host 127.0.0.1 --port 5173   # 背景跑（確認沒有別的 worktree dev server 在跑）
playwright-cli open --persistent --profile ~/.desk-dev/pw-profile http://127.0.0.1:5173
```

先探測登入狀態（畫面是否顯示帳號、能否進專注頁）。**已登入就直接驗收**；未登入才請使用者用丟棄式測試帳號走一次 device flow（WSPC 端 Approve）後再續。

- [ ] **Step 2：逐項驗收並截圖落地**

對照下方驗收標準逐條實機操作，截圖存到 `docs/acceptance-reports/2026-06-11-focus-day-navigation/assets/`，命名 `NN-描述.png`：

```bash
playwright-cli screenshot --filename docs/acceptance-reports/2026-06-11-focus-day-navigation/assets/01-focus-default.png
```

建議截：預設專注頁（桌機，左欄 WeekRail）、點某天後 URL 與中間欄換頁、翻下一週後 highlight 與 WEEK 編號變化、回今天、手機寬度下底部 chip + 翻週按鈕。

驗收標準（對照 spec）：

1. route `/today` 全面變 `/focus`；`/`、login、ModeToggle 都導向 `/focus`，舊 `/today` 不再存在。
2. 桌機 WeekRail 七天可點 → 切到 `/focus/{該日}`，中間欄換成該天。
3. 上一週 / 下一週可翻週（落相鄰週同 weekday），URL、highlight、WEEK 編號同步。
4. selectedDate 非今天時出現「回今天」，點了回今天；等於今天時不顯示。
5. 手機底部 chip 可點、且兩端有翻週按鈕，行為與桌機一致。
6. 每天與控制鈕皆為真正 `<a>`（鍵盤 Tab 可達、有 focus 樣式），selected 有 `aria-current="date"`。
7. `npm run build`、`npx vitest run`、`npm run test:e2e` 皆綠。

- [ ] **Step 3：寫 `report.md`**

依 acceptance-report.md 的範本（繁中敘述、程式碼/路徑英文）：標頭引到本 plan 與 spec、「這份 plan 做了什麼」、「完成後有什麼改變」（內嵌截圖）、「驗收結果」表（逐條 ✅/⚠️/⬜）、「已知限制」。

- [ ] **Step 4：告知使用者**

回報報告路徑 `docs/acceptance-reports/2026-06-11-focus-day-navigation/report.md`，並提醒這份 gitignored、看完自行決定刪不刪。

---

## 自我檢查（writing-plans）

- **Spec coverage**：route 改名（任務 1）、WeekRail 可點+週導航+回今天（任務 2）、DayChip+手機翻週（任務 3）、e2e（任務 4）、手動驗收報告（任務 5）——spec 五大塊與七條驗收標準皆有對應任務。
- **Placeholder scan**：無 TBD / 「類似任務 N」；每個改檔步驟都附完整程式碼或精確 old→new 區塊。
- **Type consistency**：`aria-current="date"`（對齊現有 `WeekColumn`）、`addDays(selectedDate, ∓7)`、`to="/focus/$date"` + `params={{ date }}`、landmark 名稱 `週導覽` / `日期切換` 在元件與測試間一致。
