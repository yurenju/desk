# 規劃頁月欄「已排入本週」+ 摺疊記憶 實作計劃

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目標：** 規劃頁月欄把「已排到本週某天」的任務（含已完成）抽進一個可摺疊群組，主清單只留還沒排本週的待辦；三個摺疊群組的展開狀態用 localStorage 全域記住。

**架構：** 純前端，全部從現有 `custom_fields` 衍生。新增 `dayInWeek`（判定任務有效日是否落在 `weekOf(selectedDate)`）驅動 `MonthColumn` 的分組；`MonthRow` 多畫一個週幾 chip 與別週短日期提示；`CollapseGroup` 改成讀寫 localStorage。不動 wspc schema 與任何寫入。

**技術棧：** React 19、TanStack Router、Zustand、CSS Modules、Vitest + Testing Library、Playwright。

## 全域限制

- 程式碼與註解一律英文；文件敘述繁中。
- 型別檢查只用 `npm run build`（`tsc -b && vite build`），**不要**用 `tsc -p ... --noEmit`（對 solution-style root 是 no-op 假綠）。
- 測試檔要顯式 `import { describe, it, expect } from "vitest"`（本專案不靠 global）。
- 安裝相依套件用 `npm install --legacy-peer-deps`（本計劃不需新套件）。
- e2e 前先停掉 preview dev server，避免 port 衝突；e2e 用 `npm run test:e2e`。
- localStorage key 沿用 `desk.*` 命名慣例（見 `src/lib/theme.ts`）。

---

## 檔案結構

| 檔案 | 動作 | 職責 |
| --- | --- | --- |
| `src/lib/date.ts` | 修改 | 新增 `weekdayZh`、`shortDate` |
| `src/lib/date.test.ts` | 修改 | 兩個新函式的測試 |
| `src/lib/tasks.ts` | 修改 | 新增 `dayInWeek` |
| `src/lib/tasks.test.ts` | 修改 | `dayInWeek` 測試 |
| `src/features/month/MonthRow.tsx` | 修改 | 新增 `weekdayLabel` / `otherWeekDate` props 與渲染 |
| `src/features/month/MonthRow.module.css` | 修改 | `.weekChip`、`.otherDate` 樣式 |
| `src/features/month/MonthRow.test.tsx` | 修改 | chip / 提示的測試 |
| `src/features/month/MonthColumn.tsx` | 修改 | 四組分組、改名「其他已完成」、傳 props、`CollapseGroup` 加 `persistKey` |
| `src/features/month/MonthColumn.test.tsx` | 修改 | 分組、優先序、切週、persist 測試 |
| `e2e/fixtures/wspc-fake.ts` | 修改 | 加一筆「月＋本週某天」種子 |
| `e2e/plan-interaction.spec.ts` | 修改 | 新群組 + persist e2e；既有「已完成」label 改名 |
| `docs/acceptance-reports/2026-06-21-plan-month-scheduled-this-week/` | 新增 | 驗收報告（gitignored） |

---

## Task 1：衍生函式 `dayInWeek` / `weekdayZh` / `shortDate`

**Files:**
- Modify: `src/lib/date.ts`
- Modify: `src/lib/date.test.ts`
- Modify: `src/lib/tasks.ts`
- Modify: `src/lib/tasks.test.ts`

**Interfaces:**
- Produces:
  - `weekdayZh(date: string): string` —— ISO 日期 → `週日`…`週六`。
  - `shortDate(date: string): string` —— `"2026-01-05"` → `"1/5"`（無前導零）。
  - `dayInWeek(t: Task, week: string[]): string | null` —— `primaryDate(t)` 落在 `week`（`weekOf` 回傳的 7 個 ISO 日期）內就回傳該日，否則 null。

- [ ] **Step 1：寫 `date.ts` 兩個函式的失敗測試**

在 `src/lib/date.test.ts` import 改成包含 `weekdayZh, shortDate`，並在檔尾加：

```ts
describe("weekdayZh", () => {
  it("maps ISO dates to Chinese weekday labels", () => {
    expect(weekdayZh("2024-01-07")).toBe("週日"); // 2024-01-07 is a Sunday
    expect(weekdayZh("2024-01-08")).toBe("週一");
    expect(weekdayZh("2024-01-13")).toBe("週六");
  });
});

describe("shortDate", () => {
  it("formats YYYY-MM-DD as M/D without leading zeros", () => {
    expect(shortDate("2026-01-05")).toBe("1/5");
    expect(shortDate("2026-12-28")).toBe("12/28");
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/lib/date.test.ts`
Expected: FAIL（`weekdayZh`/`shortDate` is not exported / not a function）。

- [ ] **Step 3：在 `date.ts` 實作**

加在 `src/lib/date.ts`（接在 `shortWeekday` 附近）：

```ts
/** Returns Chinese weekday label: "週日" / "週一" / ... */
export function weekdayZh(date: string): string {
  const d = new Date(date + "T00:00:00");
  return ["週日", "週一", "週二", "週三", "週四", "週五", "週六"][d.getDay()];
}

/** Formats YYYY-MM-DD as "M/D" without leading zeros, e.g. "1/5". */
export function shortDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}/${d}`;
}
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/lib/date.test.ts`
Expected: PASS。

- [ ] **Step 5：寫 `dayInWeek` 的失敗測試**

在 `src/lib/tasks.test.ts` 確保有 `import { dayInWeek } from "./tasks";`、`import { weekOf } from "./date";`、`import type { Task } from "./types";`（缺則補上），並加：

```ts
describe("dayInWeek", () => {
  const wk = weekOf("2099-01-15");
  const mk = (dates?: string[], u?: string): Task => ({
    id: "t", title: "t", status: "open", created_at: "x", updated_at: "x",
    custom_fields: { scheduled_dates: dates, unscheduled_at: u },
  });
  it("returns the day when primaryDate falls inside the week", () => {
    expect(dayInWeek(mk(["2099-01-15"]), wk)).toBe("2099-01-15");
  });
  it("returns null when primaryDate is outside the week", () => {
    expect(dayInWeek(mk(["2099-01-28"]), wk)).toBeNull();
  });
  it("returns null when there is no scheduled date", () => {
    expect(dayInWeek(mk(undefined), wk)).toBeNull();
  });
  it("returns null when unscheduled_at cancels the date", () => {
    expect(dayInWeek(mk(["2099-01-15"], "2099-01-20"), wk)).toBeNull();
  });
});
```

- [ ] **Step 6：跑測試確認失敗**

Run: `npx vitest run src/lib/tasks.test.ts`
Expected: FAIL（`dayInWeek` is not exported）。

- [ ] **Step 7：在 `tasks.ts` 實作**

加在 `src/lib/tasks.ts`（接在 `primaryDate` 之後）：

```ts
/** The task's effective day if it falls within `week` (the 7 ISO dates from
 * weekOf), else null. Used to mark month tasks already placed in the viewed week. */
export function dayInWeek(t: Task, week: string[]): string | null {
  const d = primaryDate(t);
  return d && week.includes(d) ? d : null;
}
```

- [ ] **Step 8：跑測試確認通過**

Run: `npx vitest run src/lib/tasks.test.ts src/lib/date.test.ts`
Expected: PASS。

- [ ] **Step 9：Commit**

```bash
git add src/lib/date.ts src/lib/date.test.ts src/lib/tasks.ts src/lib/tasks.test.ts
git commit -m "feat(plan): add dayInWeek / weekdayZh / shortDate helpers"
```

---

## Task 2：`MonthRow` 加週幾 chip 與別週短日期提示

**Files:**
- Modify: `src/features/month/MonthRow.tsx`
- Modify: `src/features/month/MonthRow.module.css`
- Modify: `src/features/month/MonthRow.test.tsx`

**Interfaces:**
- Consumes: 無（純新增 optional props，預設行為不變）。
- Produces: `MonthRowProps` 多兩個 optional 欄位：
  - `weekdayLabel?: string` —— 有值時在標題後顯示週幾 chip（用於「已排入本週」列）。
  - `otherWeekDate?: string` —— 有值時顯示淡色短日期（用於排到別週的「其他任務」列）。

- [ ] **Step 1：寫失敗測試**

在 `src/features/month/MonthRow.test.tsx` 檔尾加：

```ts
it("renders a weekday chip when weekdayLabel is set", () => {
  useTasksStore.setState({
    tasks: [{ id: "w1", title: "排定任務", status: "open", created_at: "x", updated_at: "x",
      custom_fields: { scheduled_months: ["2026-05"] } }],
    today: "2026-05-22", status: "ready", error: null,
  });
  render(<MonthRow task={useTasksStore.getState().tasks[0]} kind="primary"
    month="2026-05" selectedDate="2026-05-22" interactive weekdayLabel="週二" />);
  expect(screen.getByText("週二")).toBeInTheDocument();
});

it("renders a short-date hint when otherWeekDate is set", () => {
  useTasksStore.setState({
    tasks: [{ id: "w2", title: "別週任務", status: "open", created_at: "x", updated_at: "x",
      custom_fields: { scheduled_months: ["2026-05"] } }],
    today: "2026-05-22", status: "ready", error: null,
  });
  render(<MonthRow task={useTasksStore.getState().tasks[0]} kind="primary"
    month="2026-05" selectedDate="2026-05-22" interactive otherWeekDate="1/28" />);
  expect(screen.getByText("1/28")).toBeInTheDocument();
});

it("renders neither chip nor hint by default", () => {
  useTasksStore.setState({
    tasks: [{ id: "w3", title: "普通任務", status: "open", created_at: "x", updated_at: "x",
      custom_fields: { scheduled_months: ["2026-05"] } }],
    today: "2026-05-22", status: "ready", error: null,
  });
  render(<MonthRow task={useTasksStore.getState().tasks[0]} kind="primary"
    month="2026-05" selectedDate="2026-05-22" interactive />);
  expect(screen.queryByText("週二")).toBeNull();
  expect(screen.queryByText("1/28")).toBeNull();
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/features/month/MonthRow.test.tsx`
Expected: FAIL（`weekdayLabel`/`otherWeekDate` 不是有效 prop、chip 文字找不到）。

- [ ] **Step 3：加 props 到 `MonthRowProps`**

修改 `src/features/month/MonthRow.tsx` 的 interface 與解構：

```ts
export interface MonthRowProps {
  task: Task;
  kind: TrailKind;
  month: string;
  selectedDate: string;
  interactive?: boolean;
  showRing?: boolean;
  weekdayLabel?: string;
  otherWeekDate?: string;
}

export function MonthRow({
  task,
  kind,
  month,
  selectedDate,
  interactive,
  showRing,
  weekdayLabel,
  otherWeekDate,
}: MonthRowProps) {
```

- [ ] **Step 4：渲染 chip / 提示**

在 `MonthRow.tsx` 的 `{isAdhoc && <UnplannedChip />}` 那行**之後**、`{!row.isEditing && <TaskDetailTrigger task={task} />}` 之前，插入：

```tsx
{weekdayLabel && <span className={styles.weekChip}>{weekdayLabel}</span>}
{otherWeekDate && <span className={styles.otherDate}>{otherWeekDate}</span>}
```

- [ ] **Step 5：加樣式**

在 `src/features/month/MonthRow.module.css` 檔尾加：

```css
.weekChip {
  flex: none;
  font-family: var(--font-sans);
  font-size: var(--text-2xs);
  color: var(--color-ink-soft);
  background: var(--color-paper-alt);
  padding: 1px 7px;
  border-radius: 999px;
}
.otherDate {
  flex: none;
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  color: var(--color-ink-faint);
}
```

- [ ] **Step 6：跑測試確認通過**

Run: `npx vitest run src/features/month/MonthRow.test.tsx`
Expected: PASS。

- [ ] **Step 7：Commit**

```bash
git add src/features/month/MonthRow.tsx src/features/month/MonthRow.module.css src/features/month/MonthRow.test.tsx
git commit -m "feat(plan): MonthRow weekday chip + other-week date hint props"
```

---

## Task 3：`CollapseGroup` 用 localStorage 記住展開狀態

**Files:**
- Modify: `src/features/month/MonthColumn.tsx`
- Modify: `src/features/month/MonthColumn.test.tsx`

**Interfaces:**
- Consumes: 無。
- Produces: `CollapseGroup` 多一個必填 prop `persistKey: string`；展開時 localStorage 存 `"open"`、收合存 `"collapsed"`；無值預設收合。本 Task 先把現有「已完成 (N)」「已移走 (N)」兩組接上 key。

- [ ] **Step 1：寫失敗測試（用「已移走」組驗 persist）**

先把 `src/features/month/MonthColumn.test.tsx` 的 `beforeEach` 末尾加一行 `localStorage.clear();`（避免測試間殘留）。然後加：

```ts
it("remembers a collapse group's expanded state across remount via localStorage", async () => {
  useTasksStore.setState({
    tasks: [
      { id: "fw", title: "已順延任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01", "2099-02"] } },
    ],
    today: "2099-01-15", status: "ready", error: null,
  });
  const first = renderInRouter("/plan/2099-01-15");
  await userEvent.click(await screen.findByRole("button", { name: /已移走 \(1\)/ }));
  expect(screen.getByText("已順延任務")).toBeInTheDocument();
  first.unmount();

  // Remount: the expanded state must be restored from localStorage without clicking.
  renderInRouter("/plan/2099-01-15");
  expect(await screen.findByText("已順延任務")).toBeInTheDocument();
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/features/month/MonthColumn.test.tsx -t "remembers a collapse"`
Expected: FAIL（remount 後 `已順延任務` 不在 —— 狀態沒被記住）。

- [ ] **Step 3：改 `CollapseGroup` 加 persist**

在 `src/features/month/MonthColumn.tsx`，於 `CollapseGroup` 函式上方加兩個 helper：

```ts
function readOpen(key: string): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(key) === "open";
}
function writeOpen(key: string, open: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, open ? "open" : "collapsed");
}
```

把 `CollapseGroup` 改成：

```tsx
/** Collapsible group (e.g. 已排入本週 / 其他已完成 / 已移走) whose open/closed
 * state persists in localStorage under `persistKey` (default collapsed). */
function CollapseGroup({
  label,
  count,
  persistKey,
  children,
}: {
  label: string;
  count: number;
  persistKey: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(persistKey));
  function toggle() {
    setOpen((v) => {
      writeOpen(persistKey, !v);
      return !v;
    });
  }
  return (
    <div className={styles.doneGroup}>
      <button
        type="button"
        className={styles.doneToggle}
        aria-expanded={open}
        onClick={toggle}
      >
        {open ? "▾" : "▸"} {label} ({count})
      </button>
      {open && children}
    </div>
  );
}
```

- [ ] **Step 4：把現有兩組接上 key**

在 `MonthColumn.tsx` 的 JSX，把現有兩個 `CollapseGroup` 各補 `persistKey`：

```tsx
<CollapseGroup label="已完成" count={doneAll.length} persistKey="desk.plan.month.collapse.done">
```
```tsx
<CollapseGroup label="已移走" count={movedAway.length} persistKey="desk.plan.month.collapse.movedAway">
```

（「已完成」這組的 label 與內容在 Task 4 才改名／改算，本 Task 只接 key。）

- [ ] **Step 5：跑測試確認通過**

Run: `npx vitest run src/features/month/MonthColumn.test.tsx`
Expected: PASS（含原有測試與新 persist 測試）。

- [ ] **Step 6：Commit**

```bash
git add src/features/month/MonthColumn.tsx src/features/month/MonthColumn.test.tsx
git commit -m "feat(plan): persist month CollapseGroup expand state in localStorage"
```

---

## Task 4：`MonthColumn` 分出「已排入本週」、改名「其他已完成」

**Files:**
- Modify: `src/features/month/MonthColumn.tsx`
- Modify: `src/features/month/MonthColumn.test.tsx`

**Interfaces:**
- Consumes: `dayInWeek`、`primaryDate`（`tasks.ts`）、`weekOf`、`weekdayZh`、`shortDate`（`date.ts`）、`MonthRow` 的 `weekdayLabel`/`otherWeekDate` props、`CollapseGroup` 的 `persistKey`。
- Produces: 月欄非 top3 列依優先序分四組顯示：其他任務（展開）→ 已排入本週（摺疊）→ 其他已完成（摺疊）→ 已移走（摺疊）。

- [ ] **Step 1：寫失敗測試**

在 `src/features/month/MonthColumn.test.tsx` 補 import：`import { weekdayZh, shortDate } from "@/lib/date";`，並加：

```ts
it("groups a task scheduled into the viewed week under 已排入本週 with a weekday chip", async () => {
  useTasksStore.setState({
    tasks: [
      { id: "s1", title: "本週任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], scheduled_dates: ["2099-01-15"] } },
    ],
    today: "2099-01-15", status: "ready", error: null,
  });
  renderInRouter("/plan/2099-01-15");
  const toggle = await screen.findByRole("button", { name: /已排入本週 \(1\)/ });
  expect(screen.queryByText("本週任務")).toBeNull();
  await userEvent.click(toggle);
  expect(screen.getByText("本週任務")).toBeInTheDocument();
  expect(screen.getByText(weekdayZh("2099-01-15"))).toBeInTheDocument();
});

it("keeps a done task scheduled this week in 已排入本週, not 其他已完成", async () => {
  useTasksStore.setState({
    tasks: [
      { id: "sd", title: "本週做完", status: "done", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], scheduled_dates: ["2099-01-15"] } },
    ],
    today: "2099-01-15", status: "ready", error: null,
  });
  renderInRouter("/plan/2099-01-15");
  expect(await screen.findByRole("button", { name: /已排入本週 \(1\)/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /其他已完成/ })).toBeNull();
});

it("keeps a task scheduled in another week in 其他任務 with a short-date hint", async () => {
  useTasksStore.setState({
    tasks: [
      { id: "ow", title: "別週任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], scheduled_dates: ["2099-01-28"] } },
    ],
    today: "2099-01-15", status: "ready", error: null,
  });
  renderInRouter("/plan/2099-01-15");
  expect(await screen.findByText("別週任務")).toBeInTheDocument(); // visible, not collapsed
  expect(screen.getByText(shortDate("2099-01-28"))).toBeInTheDocument(); // "1/28"
});

it("moves a task into 已排入本週 when its week is the one being viewed", async () => {
  useTasksStore.setState({
    tasks: [
      { id: "ow2", title: "別週任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], scheduled_dates: ["2099-01-28"] } },
    ],
    today: "2099-01-15", status: "ready", error: null,
  });
  renderInRouter("/plan/2099-01-28");
  expect(await screen.findByRole("button", { name: /已排入本週 \(1\)/ })).toBeInTheDocument();
});
```

同時把既有測試 `collapses completed tasks into a 已完成 group, expandable on click` 與 `puts a completed forwarded task into 已完成, ...` 兩個測試裡的 group 名稱由 `已完成` 改成 `其他已完成`（這兩個 case 的任務都沒排到本週，仍歸該組）：把 `name: /已完成 \(1\)/` 改成 `name: /其他已完成 \(1\)/`。

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/features/month/MonthColumn.test.tsx`
Expected: FAIL（找不到「已排入本週」按鈕；改名後的「其他已完成」也還沒實作）。

- [ ] **Step 3：改 `MonthColumn` 分組邏輯**

把 `src/features/month/MonthColumn.tsx` 裡從 `const entries = useMemo(...)` 到 `const movedAway = ...` 那段（目前的 `top3` / `rest` / `undoneOthers` / `doneAll` / `movedAway` 計算）整段換成：

```tsx
  const week = useMemo(() => weekOf(selectedDate), [selectedDate]);
  const entries = useMemo(() => tasksOnMonth(allTasks, month), [allTasks, month]);

  const top3 = entries
    .filter((e) => e.kind === "primary" && e.task.custom_fields.monthly_priority)
    .sort(
      (a, b) =>
        Number(a.task.custom_fields.monthly_priority) -
        Number(b.task.custom_fields.monthly_priority),
    )
    .map((e) => e.task);

  // Everything outside top3, partitioned by precedence (first match wins):
  // 1) placed on a day in the viewed week (incl. done), 2) done elsewhere,
  // 3) moved away (undone, forwarded/dismissed), 4) the live "other tasks" pool.
  const rest = entries.filter(
    (e) => !(e.kind === "primary" && e.task.custom_fields.monthly_priority),
  );
  const scheduledThisWeek = rest
    .filter((e) => dayInWeek(e.task, week) !== null)
    .sort((a, b) => (dayInWeek(a.task, week)! < dayInWeek(b.task, week)! ? -1 : 1));
  const remaining = rest.filter((e) => dayInWeek(e.task, week) === null);
  const doneOther = remaining.filter((e) => e.task.status === "done");
  const undone = remaining.filter((e) => e.task.status !== "done");
  const movedAway = undone.filter((e) => e.kind !== "primary");
  // 計劃外 (adhoc) sinks below 計劃內; Array.sort is stable so order is preserved.
  const others = undone
    .filter((e) => e.kind === "primary")
    .sort(
      (a, b) =>
        Number(a.task.custom_fields.is_adhoc === "true") -
        Number(b.task.custom_fields.is_adhoc === "true"),
    );

  const nothing =
    top3.length === 0 &&
    others.length === 0 &&
    scheduledThisWeek.length === 0 &&
    doneOther.length === 0 &&
    movedAway.length === 0;
```

- [ ] **Step 4：改 import**

把 `MonthColumn.tsx` 頂部的 import 補上需要的衍生函式：

```ts
import { tasksOnMonth, dayInWeek, primaryDate } from "@/lib/tasks";
import { formatMonth, addMonths, weekOf, weekdayZh, shortDate } from "@/lib/date";
```

- [ ] **Step 5：改 JSX —— 主清單用 `others`、加「已排入本週」、改名「其他已完成」**

把目前「其他任務」section、「已完成」CollapseGroup、「已移走」CollapseGroup 三塊（從 `{undoneOthers.length > 0 && (` 到 `已移走` 那個 `</CollapseGroup>`）整段換成：

```tsx
      {others.length > 0 && (
        <section className={styles.section}>
          <header className={styles.sectionHead}>其他任務</header>
          {others.map((e) => {
            const pd = primaryDate(e.task);
            const otherWeekDate = pd && !week.includes(pd) ? shortDate(pd) : undefined;
            return (
              <MonthRow
                key={e.task.id}
                task={e.task}
                kind={e.kind}
                month={month}
                selectedDate={selectedDate}
                interactive
                showRing
                otherWeekDate={otherWeekDate}
              />
            );
          })}
        </section>
      )}

      {scheduledThisWeek.length > 0 && (
        <CollapseGroup
          label="已排入本週"
          count={scheduledThisWeek.length}
          persistKey="desk.plan.month.collapse.scheduledThisWeek"
        >
          {scheduledThisWeek.map((e) => (
            <MonthRow
              key={e.task.id}
              task={e.task}
              kind={e.kind}
              month={month}
              selectedDate={selectedDate}
              interactive
              showRing
              weekdayLabel={weekdayZh(dayInWeek(e.task, week)!)}
            />
          ))}
        </CollapseGroup>
      )}

      {doneOther.length > 0 && (
        <CollapseGroup
          label="其他已完成"
          count={doneOther.length}
          persistKey="desk.plan.month.collapse.done"
        >
          {doneOther.map((e) => (
            <MonthRow
              key={e.task.id}
              task={e.task}
              kind={e.kind}
              month={month}
              selectedDate={selectedDate}
              interactive
              showRing
            />
          ))}
        </CollapseGroup>
      )}

      {movedAway.length > 0 && (
        <CollapseGroup
          label="已移走"
          count={movedAway.length}
          persistKey="desk.plan.month.collapse.movedAway"
        >
          {movedAway.map((e) => (
            <MonthRow
              key={e.task.id}
              task={e.task}
              kind={e.kind}
              month={month}
              selectedDate={selectedDate}
              interactive
            />
          ))}
        </CollapseGroup>
      )}
```

- [ ] **Step 6：跑測試確認通過**

Run: `npx vitest run src/features/month/MonthColumn.test.tsx`
Expected: PASS（含 Task 3 的 persist 測試 —— 注意 persist 測試用「已移走」組，不受改名影響）。

- [ ] **Step 7：型別檢查 + 全單元測試**

Run: `npm run build && npx vitest run`
Expected: build 成功、所有測試 PASS。

- [ ] **Step 8：Commit**

```bash
git add src/features/month/MonthColumn.tsx src/features/month/MonthColumn.test.tsx
git commit -m "feat(plan): split month tasks scheduled into the viewed week into a collapsible group"
```

---

## Task 5：e2e 涵蓋 + 全套驗證

**Files:**
- Modify: `e2e/fixtures/wspc-fake.ts`
- Modify: `e2e/plan-interaction.spec.ts`

**Interfaces:**
- Consumes: 前面所有 Task 的 UI。
- Produces: e2e 覆蓋「已排入本週群組存在且含週幾」「展開狀態 reload 後保留」；既有「已完成」e2e 改名為「其他已完成」。

- [ ] **Step 1：加一筆「月＋本週某天」種子**

在 `e2e/fixtures/wspc-fake.ts` 的 `todos.push( ... )`（月任務區塊，`本月延遲 D` 之後、結尾 `)` 之前）加一筆。它同時排到當月與「今天」（今天必落在當週），所以會進「已排入本週」：

```ts
    {
      id: "pm5",
      project_id: PROJECT_ID,
      type_id: TYPE_ID,
      status: "open",
      title: "本月排入本週 E",
      created_at: base,
      updated_at: base,
      custom_fields: { scheduled_months: [month], scheduled_dates: [today], is_adhoc: "false" },
    },
```

- [ ] **Step 2：既有「已完成」e2e 改名**

在 `e2e/plan-interaction.spec.ts` 把 `completed month tasks collapse into a 已完成 group, expandable on click` 這個 test 內的按鈕名稱由 `/已完成 \(\d+\)/` 改成 `/其他已完成 \(\d+\)/`（`本月已完成 C` 沒排到本週，仍歸「其他已完成」）。

- [ ] **Step 3：新增 e2e 測試**

在 `e2e/plan-interaction.spec.ts` 檔尾加：

```ts
test("a month task scheduled into this week shows in 已排入本週 and persists expand state", async ({
  page,
}) => {
  // pm5 ("本月排入本週 E") is scheduled to today (within this week) → collapsed
  // under 已排入本週 by default.
  const toggle = page.getByRole("button", { name: /已排入本週 \(\d+\)/ });
  await expect(toggle).toBeVisible();
  await expect(page.getByText("本月排入本週 E")).toBeHidden();

  // Expand → the task is revealed.
  await toggle.click();
  await expect(page.getByText("本月排入本週 E")).toBeVisible();

  // Expand state persists across reload (localStorage).
  await page.reload();
  await expect(page.getByText("本月排入本週 E")).toBeVisible();
});
```

- [ ] **Step 4：停掉 preview dev server（若有在跑）後跑 e2e**

Run: `npm run test:e2e`
Expected: 全部 PASS（含改名後的「其他已完成」與新群組測試）。

- [ ] **Step 5：最終全套驗證**

Run: `npm run build && npx vitest run && npm run test:e2e`
Expected: build 成功、vitest 全 PASS、e2e 全 PASS。

- [ ] **Step 6：Commit**

```bash
git add e2e/fixtures/wspc-fake.ts e2e/plan-interaction.spec.ts
git commit -m "test(e2e): cover plan month 已排入本週 group + persisted expand"
```

---

## Task 6：手動驗收 + 驗收報告

**Files:**
- Create: `docs/acceptance-reports/2026-06-21-plan-month-scheduled-this-week/`（gitignored；報告 + `assets/` 截圖）

依 [.claude/rules/acceptance-report.md](../../../.claude/rules/acceptance-report.md) 的格式與 playwright-cli 截圖落地流程執行。

- [ ] **Step 1：開 preview，用共用 profile 探登入狀態**

用 `playwright-cli open --persistent --profile ~/.desk-dev/pw-profile <preview-url>/plan` 開頁面。已登入直接驗收；未登入才請使用者協助 device flow。

- [ ] **Step 2：逐項對照驗收標準操作並截圖**

對照 spec「驗收標準」逐項驗收，至少涵蓋：

1. 月欄「其他任務」只剩未完成、且沒排到本週的任務。
2. 排到本週某天的任務（含已完成）在「▸ 已排入本週 (N)」內，每列有週幾標示；已完成者刪節線。
3. 切到不同週時，「已排入本週」內容隨之改變。
4. 排到本週的已完成任務只出現在「已排入本週」，不重複在「其他已完成」。
5. 三組摺疊狀態：手動展開後重整仍保留；切週切月不自動變動。
6. 排到別週某天的未完成任務留在「其他任務」、右側有淡 `M/D`。

截圖用 `playwright-cli screenshot --filename` 落地到報告的 `assets/`。

- [ ] **Step 3：寫驗收報告**

把報告寫到 `docs/acceptance-reports/2026-06-21-plan-month-scheduled-this-week/`，截圖 inline 內嵌（見 acceptance-report rule）。逐項標 PASS/FAIL。

- [ ] **Step 4：回報結果**

回報每項驗收標準的 PASS/FAIL 與報告路徑；有 FAIL 則回到對應 Task 修正。

---

## 自我檢查

- **spec 覆蓋**：驗收標準 1–6 → Task 4（分組）+ Task 3（persist）+ Task 2（chip/提示）；標準 7（純前端）→ 全程不碰 schema/寫入；標準 8（build/vitest/e2e）→ Task 4 Step 7 + Task 5 Step 5。手動驗收 → Task 6。
- **無 placeholder**：每個程式步驟都有完整程式碼與確切指令。
- **型別一致**：`dayInWeek(t, week)`、`weekdayZh(date)`、`shortDate(date)`、`MonthRow` 的 `weekdayLabel`/`otherWeekDate`、`CollapseGroup` 的 `persistKey` 在定義與使用處名稱一致；localStorage key（`scheduledThisWeek`/`done`/`movedAway`）三處一致。
