# Recurring occurrence 自動排入每日 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目標:** 讓帶 `recurrence_occurrence_at` 的 WSPC recurring occurrence 自動排進它該在的那一天的「其他計劃內」，帶 ↻ 標記，不再積在 backlog。

**架構:** 在 BFF 的 mapping 層（`worker/todo-mapper.ts`）做純讀取衍生 —— 當 todo 有 `recurrence_occurrence_at` 且沒有 `scheduled_dates` 時，合成 `scheduled_dates = [recurrence_occurrence_at]`，並在 Task 上設衍生欄位 `recurring: true`。前端 `layer()` / `tasksOnDate()` / 拖拉 / trail 邏輯完全不動，只在 Day 欄與 Week 欄依 `recurring` 多畫一個 ↻。

**技術棧:** TypeScript、React、Cloudflare Workers（BFF）、Vitest、Testing Library、Playwright（e2e）。

**對應 spec:** [docs/superpowers/specs/2026-06-10-recurring-occurrence-display-design.md](../specs/2026-06-10-recurring-occurrence-display-design.md)

---

## 檔案結構

| 檔案 | 角色 | 動作 |
| --- | --- | --- |
| `worker/wspc.ts` | WSPC `Todo` 型別 | 修改：補 `due_at` / `recurrence_occurrence_at` / `recurring_template_id` |
| `worker/todo-mapper.ts` | WSPC todo → 前端 `Task` 的唯一 mapping 點 | 修改：合成 `scheduled_dates`、設 `recurring` |
| `worker/todo-mapper.test.ts` | mapper 單元測試 | 修改：加 recurring 三案例 |
| `src/lib/types.ts` | 前端 `Task` 型別 | 修改：加 `recurring?: boolean` |
| `src/features/day/TaskRow.tsx` | Day 欄任務列 | 修改：依 `recurring` 顯示 ↻ |
| `src/features/day/TaskRow.module.css` | TaskRow 樣式 | 修改：加 `.recurring` |
| `src/features/day/TaskRow.test.tsx` | TaskRow 元件測試 | 修改：加 ↻ 呈現/不呈現 |
| `src/features/week/WeekColumn.tsx` | Week 欄 | 修改：`WeekTaskItem` 依 `recurring` 把 bullet 換 ↻ |
| `src/features/week/WeekColumn.test.tsx` | Week 欄測試 | 修改：加 recurring bullet 案例 |
| `e2e/fixtures/wspc-fake.ts` | e2e 假 WSPC | 修改：`Todo` 型別 + seed 一筆 recurring occurrence |
| `e2e/plan-interaction.spec.ts` | e2e | 修改：加「occurrence 排進當天、不在 backlog」案例 |

---

## Task 1: BFF mapping 合成 scheduled_dates 並標記 recurring

**Files:**
- Modify: `worker/wspc.ts`（`Todo` interface，約 line 294-303）
- Modify: `src/lib/types.ts`（`Task` interface，約 line 27-36）
- Modify: `worker/todo-mapper.ts`（`mapTodoToTask`）
- Test: `worker/todo-mapper.test.ts`

- [ ] **Step 1: 先擴充型別（讓測試能編譯）**

`worker/wspc.ts` 的 `Todo` interface 補三個 optional 原生欄位（值本來就在 WSPC JSON 裡，只是沒型別）：

```ts
export interface Todo {
  id: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  title: string;
  created_at: number;
  updated_at: number;
  description?: string;
  child_count?: number;
  custom_fields?: Record<string, string | string[]>;
  due_at?: string;
  recurrence_occurrence_at?: string;
  recurring_template_id?: string;
}
```

`src/lib/types.ts` 的 `Task` interface 補一個衍生欄位（**不**進 `custom_fields`）：

```ts
export interface Task {
  id: string;
  title: string;
  description?: string;
  subtask_count?: number;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  custom_fields: TaskCustomFields;
  recurring?: boolean;
}
```

- [ ] **Step 2: 寫失敗的測試**

在 `worker/todo-mapper.test.ts` 末尾、`describe("mapTodoToSubtask", ...)` 之前，加：

```ts
describe("mapTodoToTask recurring occurrences", () => {
  it("synthesizes scheduled_dates from recurrence_occurrence_at when none exist", () => {
    const task = mapTodoToTask({
      id: "tod_r1",
      status: "open",
      title: "每日例行",
      created_at: 0,
      updated_at: 0,
      recurring_template_id: "tpl_1",
      recurrence_occurrence_at: "2026-06-10",
      due_at: "2026-06-10",
    });
    expect(task.custom_fields.scheduled_dates).toEqual(["2026-06-10"]);
    expect(task.recurring).toBe(true);
  });

  it("does not override existing scheduled_dates (user already moved it)", () => {
    const task = mapTodoToTask({
      id: "tod_r2",
      status: "open",
      title: "每日例行",
      created_at: 0,
      updated_at: 0,
      recurring_template_id: "tpl_1",
      recurrence_occurrence_at: "2026-06-10",
      custom_fields: { scheduled_dates: ["2026-06-12"] },
    });
    expect(task.custom_fields.scheduled_dates).toEqual(["2026-06-12"]);
    expect(task.recurring).toBe(true);
  });

  it("leaves a plain due_at todo (no recurrence) in backlog", () => {
    const task = mapTodoToTask({
      id: "tod_d1",
      status: "open",
      title: "寫自己的 todo app",
      created_at: 0,
      updated_at: 0,
      due_at: "2026-05-24",
    });
    expect(task.custom_fields.scheduled_dates).toBeUndefined();
    expect(task.recurring).toBeFalsy();
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `npx vitest run worker/todo-mapper.test.ts`
Expected: FAIL —— 新的三個案例失敗（`scheduled_dates` 沒被合成、`recurring` 是 undefined）。

- [ ] **Step 4: 實作 mapper**

把 `worker/todo-mapper.ts` 的 `mapTodoToTask` 改成：

```ts
export function mapTodoToTask(todo: Todo): Task {
  const custom_fields = { ...(todo.custom_fields ?? {}) } as TaskCustomFields;

  // A recurring occurrence carries its date in the native recurrence_occurrence_at
  // field, not in Desk's scheduled_dates custom field. Synthesize scheduled_dates
  // so layer()/tasksOnDate() place it on its day. Only when the user hasn't already
  // scheduled it (i.e. no scheduled_dates yet) — once moved, the real value wins.
  const hasScheduledDates =
    Array.isArray(custom_fields.scheduled_dates) && custom_fields.scheduled_dates.length > 0;
  if (todo.recurrence_occurrence_at && !hasScheduledDates) {
    custom_fields.scheduled_dates = [todo.recurrence_occurrence_at];
  }

  return {
    id: todo.id,
    title: todo.title,
    description: todo.description ? todo.description : undefined,
    subtask_count: todo.child_count ?? 0,
    status: todo.status,
    created_at: new Date(todo.created_at).toISOString(),
    updated_at: new Date(todo.updated_at).toISOString(),
    custom_fields,
    ...(todo.recurring_template_id ? { recurring: true } : {}),
  };
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run worker/todo-mapper.test.ts`
Expected: PASS（含原有的「flattens custom_fields」「defaults missing custom_fields」等案例都還綠）。

- [ ] **Step 6: Commit**

```bash
git add worker/wspc.ts worker/todo-mapper.ts worker/todo-mapper.test.ts src/lib/types.ts
git commit -m "feat(todo): schedule recurring occurrences onto their occurrence day"
```

---

## Task 2: Day 欄 TaskRow 顯示 ↻

**Files:**
- Modify: `src/features/day/TaskRow.tsx`
- Modify: `src/features/day/TaskRow.module.css`
- Test: `src/features/day/TaskRow.test.tsx`

- [ ] **Step 1: 寫失敗的測試**

在 `src/features/day/TaskRow.test.tsx` 末尾加一個 describe（檔案最上面已 `import type { Task }`？沒有的話補上 `import type { Task } from "@/lib/types";`）：

```ts
describe("TaskRow recurring marker", () => {
  function recurringTask(): Task {
    return {
      id: "r1",
      title: "每日例行",
      status: "open",
      created_at: "x",
      updated_at: "x",
      custom_fields: { scheduled_dates: ["2026-06-10"] },
      recurring: true,
    };
  }

  it("shows a ↻ marker for a recurring task", () => {
    render(<TaskRow task={recurringTask()} kind="primary" date="2026-06-10" />);
    expect(screen.getByLabelText("重複任務")).toBeInTheDocument();
  });

  it("shows no ↻ marker for a non-recurring task", () => {
    render(rowFor("d5"));
    expect(screen.queryByLabelText("重複任務")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/features/day/TaskRow.test.tsx`
Expected: FAIL —— 找不到 label「重複任務」的元素。

- [ ] **Step 3: 實作 ↻ 標記**

`src/features/day/TaskRow.tsx`：在 `titleRow` 區塊、`<span className={styles.title}>{task.title}</span>` 之後、`kind === "forwarded"` 那行之前，插入：

```tsx
{task.recurring && (
  <span className={styles.recurring} role="img" aria-label="重複任務" title="每日重複">
    ↻
  </span>
)}
```

`src/features/day/TaskRow.module.css`：在 `.trail` 規則附近加：

```css
.recurring {
  color: #5a8a4a;
  font-size: 0.85em;
  flex: none;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/features/day/TaskRow.test.tsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/features/day/TaskRow.tsx src/features/day/TaskRow.module.css src/features/day/TaskRow.test.tsx
git commit -m "feat(day): mark recurring tasks with a ↻ glyph in the day column"
```

---

## Task 3: Week 欄 recurring bullet 顯示 ↻

**Files:**
- Modify: `src/features/week/WeekColumn.tsx`
- Test: `src/features/week/WeekColumn.test.tsx`

- [ ] **Step 1: 寫失敗的測試**

在 `src/features/week/WeekColumn.test.tsx` 末尾加（檔案頂部已 `import type { Task }`）：

```ts
it("marks a recurring other-task with ↻ instead of a bullet", async () => {
  const recurring: Task = {
    id: "rec1",
    title: "每日例行",
    status: "open",
    created_at: "x",
    updated_at: "x",
    custom_fields: { scheduled_dates: [FOCUS] },
    recurring: true,
  };
  renderWithTasks([recurring]);
  const cell = await focusCell();
  await waitFor(() => expect(within(cell).getByText("每日例行")).toBeInTheDocument());
  expect(within(cell).getByText("↻")).toBeInTheDocument();
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/features/week/WeekColumn.test.tsx`
Expected: FAIL —— cell 內找不到「↻」文字（目前 other-task 的 bullet 是「·」）。

- [ ] **Step 3: 實作**

`src/features/week/WeekColumn.tsx`：

(a) `WeekTaskItemProps` 加一個 optional 欄位：

```ts
interface WeekTaskItemProps {
  taskId: string;
  date: string;
  // 1/2/3 for the day's top-3; omitted for "other" tasks (rendered with a bullet).
  order?: number;
  title: string;
  done: boolean;
  recurring?: boolean;
}
```

(b) `WeekTaskItem` 解構與 bullet 改成（recurring 的 other-task 用 ↻，其餘照舊）：

```tsx
function WeekTaskItem({ taskId, date, order, title, done, recurring }: WeekTaskItemProps) {
  const { ref: dragRef, handleProps } = useDraggableRow(`week:${date}:${taskId}`);
  const bullet = order == null ? (recurring ? "↻" : "·") : `${order}.`;
  return (
    <li
      ref={dragRef}
      {...handleProps}
      className={[styles.task, done && styles.done, order == null && styles.otherTask]
        .filter(Boolean)
        .join(" ")}
    >
      <span className={styles.taskOrder}>{bullet}</span> {title}
    </li>
  );
}
```

(c) 在 `others.map(...)` 的 `<WeekTaskItem .../>` 加上 `recurring={e.task.recurring}`：

```tsx
{others.map((e) => (
  <WeekTaskItem
    key={e.task.id}
    taskId={e.task.id}
    date={date}
    title={e.task.title}
    done={e.task.status === "done"}
    recurring={e.task.recurring}
  />
))}
```

（top-3 的 `top3.map` 那個 `<WeekTaskItem>` 不用改 —— 三件事一定有 order、不會走 recurring bullet 分支。）

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/features/week/WeekColumn.test.tsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/features/week/WeekColumn.tsx src/features/week/WeekColumn.test.tsx
git commit -m "feat(week): render recurring other-tasks with a ↻ bullet"
```

---

## Task 4: e2e —— occurrence 排進當天、不在 backlog

**Files:**
- Modify: `e2e/fixtures/wspc-fake.ts`（`Todo` interface + `seed()`）
- Test: `e2e/plan-interaction.spec.ts`

- [ ] **Step 1: 假 WSPC 補欄位 + seed 一筆 occurrence**

`e2e/fixtures/wspc-fake.ts` 的 `interface Todo` 補三個 optional 欄位（與 worker 的 `Todo` 對齊，否則 seed 物件字面值會 TS 報錯）：

```ts
interface Todo {
  id: string;
  project_id: string;
  type_id: string;
  status: Status;
  title: string;
  created_at: number;
  updated_at: number;
  custom_fields: Record<string, string | string[]>;
  description?: string;
  parent_id?: string;
  due_at?: string;
  recurrence_occurrence_at?: string;
  recurring_template_id?: string;
}
```

在 `seed()` 裡、`// Month-scoped todos ...` 那段 `todos.push(...)` 之後，再 push 一筆「今天」的 recurring occurrence（**沒有** `scheduled_dates`，模擬 WSPC materialize 出來的樣子）：

```ts
// A recurring occurrence as WSPC materializes it: native recurrence_occurrence_at
// + due_at, no scheduled_dates custom field. The BFF must schedule it onto `today`.
todos.push({
  id: "rec1",
  project_id: PROJECT_ID,
  type_id: TYPE_ID,
  status: "open",
  title: "每日例行",
  created_at: base,
  updated_at: base,
  custom_fields: {},
  recurring_template_id: "tpl-rec",
  recurrence_occurrence_at: today,
  due_at: today,
});
```

- [ ] **Step 2: 寫 e2e 測試**

`e2e/plan-interaction.spec.ts` 末尾加：

```ts
test("recurring occurrence lands on its day with ↻ and stays out of backlog", async ({
  page,
}) => {
  // Seed has a recurring occurrence ("每日例行") for today with no scheduled_dates;
  // the BFF mapper must schedule it onto today (not backlog).
  await page.goto("/plan");

  // It shows on today's day/week views, marked recurring.
  await expect(page.getByText("每日例行").first()).toBeVisible();
  await expect(page.getByLabel("重複任務").first()).toBeVisible();

  // Backlog stays empty — the occurrence was scheduled, not dumped into backlog.
  await expect(page.getByRole("button", { name: /Backlog \(0\)/ })).toBeVisible();
});
```

- [ ] **Step 3: 跑 e2e（先確認新案例會因尚未實作而 fail，再因已實作而 pass）**

> 註：Task 1–3 已實作完，這裡 e2e 應直接 PASS。若要先看紅燈，可暫時 `git stash` worker/前端改動驗證後再 `git stash pop`（非必要）。

Run: `npm run test:e2e -- plan-interaction`
Expected: PASS —— 新案例綠，且既有 plan-interaction 案例不回歸。

- [ ] **Step 4: Commit**

```bash
git add e2e/fixtures/wspc-fake.ts e2e/plan-interaction.spec.ts
git commit -m "test(e2e): recurring occurrence schedules onto its day, not backlog"
```

---

## Task 5: 全量驗證 + 手動驗收 + 產生驗收報告

**Files:**
- Create: `docs/acceptance-reports/2026-06-10-recurring-occurrence-display/report.md`
- Create: `docs/acceptance-reports/2026-06-10-recurring-occurrence-display/assets/*.png`

- [ ] **Step 1: 全量自動化測試 + 型別檢查**

Run: `npx vitest run`
Expected: PASS（全綠）。

Run: `npm run test:e2e`
Expected: PASS（全綠）。

Run: `npm run build`
Expected: 型別檢查通過、build 成功（`tsc -b && vite build`，這是 CI / deploy 跑的指令；不要用 `tsc -p ... --noEmit`，那是 no-op 假綠）。

- [ ] **Step 2: 起 dev server 並用 playwright-cli 登入**

machine 一次性前置（缺了才裝）：

```bash
npm install -g @playwright/cli@latest
playwright-cli install --skills
```

起 server 並登入（細節見 [.claude/rules/acceptance-report.md](../../../.claude/rules/acceptance-report.md)）：

```bash
npm run dev -- --host 127.0.0.1 --port 5173   # 背景跑
playwright-cli open http://127.0.0.1:5173
playwright-cli eval "async () => (await fetch('/api/dev-login', {method:'POST'})).status"
#   回 200 = 登入成功；回 401 seed_refresh_failed 依 CLAUDE.md 重跑 device flow capture。
```

> 登入打的是真實 WSPC 測試帳號 —— 它就是這次重現問題的帳號，Desk 專案裡已有一條 `FREQ=DAILY` 的 recurrence rule 與一整排「每日例行」occurrence，正好拿來驗收。

- [ ] **Step 3: 逐項實機驗收（對照 spec 驗收標準）並截圖落地**

用 `playwright-cli snapshot` / `click` 操作，截圖存到 `docs/acceptance-reports/2026-06-10-recurring-occurrence-display/assets/`（命名 `NN-描述.png`）：

逐項確認：

1. 進 `/plan`，那條每日 rule 的「每日例行」occurrence 散到 6/9–6/23 各天的「其他計劃內」（不在三件事）。截 `01-week-spread.png`（Week 欄多天各一筆帶 ↻ 的「每日例行」）。
2. Backlog 不再有「每日例行」、件數明顯下降（本來 21）。截 `02-backlog-cleared.png`。
3. ↻ 標記在 Day 欄與 Week 欄都正確顯示。截 `03-recurring-marker.png`（Day 欄某天「其他計劃內」的「每日例行」帶 ↻）。
4. 一般帶 `due_at` 的「寫自己的 todo app」仍在 backlog（驗證範圍正確、沒誤排）。可併入 `02`。
5. 把某天的「每日例行」拖進三件事 / 移到別天 / 丟回 backlog，操作正常，重整後狀態正確。截 `04-promoted.png`。

- [ ] **Step 4: 寫驗收報告**

依 [.claude/rules/acceptance-report.md](../../../.claude/rules/acceptance-report.md) 的範本，寫 `docs/acceptance-reports/2026-06-10-recurring-occurrence-display/report.md`：

- 表頭連結到本 plan 與對應 spec、驗收日期、方式（playwright-cli 對真實 WSPC 測試帳號）。
- 「這份 plan 做了什麼」「完成後有什麼改變」（本來 21 件 backlog、一整排「每日例行」→ 現在散到各天的其他計劃內、帶 ↻），內嵌上面截圖。
- 「驗收結果」表格對照 spec 六條驗收標準逐條標 ✅ / ⚠️ / ⬜。

- [ ] **Step 5: 告知使用者**

把報告路徑告訴使用者，並提醒這份在 gitignored 的 `docs/acceptance-reports/`、不進版控，看完自行決定刪不刪。

（此 task 只產報告，無需 commit。）
