# 月份欄改版實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目標:** 月份欄收合已完成、合併計劃內/計劃外、未完成列加雙色拖延點、詳情頁加拖延摘要，讓清單變短且能掃出拖延。

**架構:** 全部純前端，從現有 `custom_fields` 衍生，不改 wspc schema。先在 `tasks.ts` 加兩個衍生函式（`delayKind` / `delaySummary`），再依序套進 `MonthRow`（點）、`MonthColumn`（合併 + 摺疊）、`TaskDetailModal`（摘要），最後補 e2e 與手動驗收。

**技術:** React + TypeScript、Vitest + Testing Library、Playwright（e2e 對真實 BFF + mock WSPC）、CSS Modules。

## 全域限制

- 程式碼與註解一律英文；UI 字串與文件敘述用繁體中文。
- 型別檢查只信 `npm run build`（= `tsc -b && vite build`），**不要**用 `tsc -p tsconfig.json --noEmit`（no-op 假綠）。
- 測試檔要顯式 `import { describe, it, expect } from "vitest"`（本專案不靠 global）。
- 安裝相依套件需 `npm install --legacy-peer-deps`（本計畫不需新套件）。
- 改到 Today 互動 / 月份欄清單呈現後，除 `npx vitest run` 也要跑 `npm run test:e2e`（先停掉 preview dev server 避免 port 衝突）。
- Git commit message 結尾加 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

## 檔案結構

| 檔案 | 動作 | 職責 |
| --- | --- | --- |
| `src/lib/tasks.ts` | 修改 | 加 `DelayKind` / `delayKind()` / `DelaySummary` / `delaySummary()` |
| `src/lib/tasks.test.ts` | 修改 | 上述兩函式的單元測試 |
| `src/features/month/MonthRow.tsx` | 修改 | 未完成 primary 列前加雙色拖延點 + hover `title` |
| `src/features/month/MonthRow.module.css` | 修改 | `.dot` / `.carried` / `.dismissed` 樣式 |
| `src/features/month/MonthRow.test.tsx` | 修改 | 拖延點的顯示測試 |
| `src/features/month/MonthColumn.tsx` | 修改 | 合併計劃內/計劃外、已完成摺疊群組 |
| `src/features/month/MonthColumn.module.css` | 修改 | `.doneGroup` / `.doneToggle` 樣式 |
| `src/features/month/MonthColumn.test.tsx` | 修改 | 合併 + 摺疊的測試 |
| `src/features/task-detail/TaskDetailModal.tsx` | 修改 | 「拖延狀況」摘要區塊 |
| `src/features/task-detail/TaskDetailModal.module.css` | 修改 | `.delayLine` 樣式 |
| `src/features/task-detail/TaskDetailModal.test.tsx` | 修改 | 摘要顯示/隱藏測試 |
| `e2e/fixtures/wspc-fake.ts` | 修改 | seed 加一個已完成、一個跨月延遲的月份任務 |
| `e2e/plan-interaction.spec.ts` | 修改 | 摺疊互動 + 拖延點的 e2e |
| `docs/acceptance-reports/month-list-redesign/` | 建立 | 手動驗收報告（gitignored） |

---

### Task 1：`delayKind`（清單端拖延判定）

**Files:**
- Modify: `src/lib/tasks.ts`
- Test: `src/lib/tasks.test.ts`

**Interfaces:**
- Produces: `type DelayKind = "none" | "dismissed" | "carried"`；`delayKind(t: Task, month: string): DelayKind`。`month` 為 `"YYYY-MM"`。

- [ ] **Step 1：寫失敗測試**

加到 `src/lib/tasks.test.ts` 末尾（`makeTask` 已存在於檔案上方）：

```ts
import { delayKind } from "./tasks";

describe("delayKind", () => {
  it("returns 'carried' when scheduled in an earlier month", () => {
    const t = makeTask({ id: "1", custom_fields: { scheduled_months: ["2026-04", "2026-06"] } });
    expect(delayKind(t, "2026-06")).toBe("carried");
  });

  it("returns 'dismissed' when unscheduled_at falls in this month", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_months: ["2026-06"], unscheduled_at: "2026-06-15" },
    });
    expect(delayKind(t, "2026-06")).toBe("dismissed");
  });

  it("prefers 'carried' over 'dismissed' when both apply", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_months: ["2026-05", "2026-06"], unscheduled_at: "2026-06-15" },
    });
    expect(delayKind(t, "2026-06")).toBe("carried");
  });

  it("returns 'none' for a fresh this-month task", () => {
    const t = makeTask({ id: "1", custom_fields: { scheduled_months: ["2026-06"] } });
    expect(delayKind(t, "2026-06")).toBe("none");
  });

  it("does not treat a previous month's unscheduled_at as this-month dismissed", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_months: ["2026-06"], unscheduled_at: "2026-05-30" },
    });
    expect(delayKind(t, "2026-06")).toBe("none");
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/lib/tasks.test.ts`
Expected: FAIL — `delayKind` is not exported / not a function。

- [ ] **Step 3：實作**

加到 `src/lib/tasks.ts`（接在 `primaryDate` 之後即可）：

```ts
export type DelayKind = "none" | "dismissed" | "carried";

/**
 * Delay signal for a task shown in `month`'s plan column.
 * - "carried": scheduled in a month earlier than `month` (still dragging on).
 * - "dismissed": was put on a day this month then bounced back to the month layer.
 * "carried" wins when both apply (it is the heavier signal).
 */
export function delayKind(t: Task, month: string): DelayKind {
  const months = t.custom_fields.scheduled_months ?? [];
  if (months.some((m) => m < month)) return "carried";
  const u = t.custom_fields.unscheduled_at ?? "";
  if (u.startsWith(month)) return "dismissed";
  return "none";
}
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/lib/tasks.test.ts`
Expected: PASS。

- [ ] **Step 5：commit**

```bash
git add src/lib/tasks.ts src/lib/tasks.test.ts
git commit -m "feat(tasks): add delayKind derivation for month-list delay signal

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2：`delaySummary`（詳情頁兩個結論）

**Files:**
- Modify: `src/lib/tasks.ts`
- Test: `src/lib/tasks.test.ts`

**Interfaces:**
- Produces: `interface DelaySummary { carriedMonths: number; earliestMonth: string | null; dismissedDate: string | null }`；`delaySummary(t: Task, month: string): DelaySummary`。`carriedMonths` 為 0 表示未跨月；`dismissedDate` 為 `null` 表示本月沒落掉過。

- [ ] **Step 1：寫失敗測試**

加到 `src/lib/tasks.test.ts`：

```ts
import { delaySummary } from "./tasks";

describe("delaySummary", () => {
  it("reports carried months and the earliest month", () => {
    const t = makeTask({ id: "1", custom_fields: { scheduled_months: ["2026-04", "2026-06"] } });
    expect(delaySummary(t, "2026-06")).toEqual({
      carriedMonths: 2,
      earliestMonth: "2026-04",
      dismissedDate: null,
    });
  });

  it("reports the dismissed date when unscheduled_at is this month", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_months: ["2026-06"], unscheduled_at: "2026-06-15" },
    });
    expect(delaySummary(t, "2026-06")).toEqual({
      carriedMonths: 0,
      earliestMonth: null,
      dismissedDate: "2026-06-15",
    });
  });

  it("reports zero delay for a fresh this-month task", () => {
    const t = makeTask({ id: "1", custom_fields: { scheduled_months: ["2026-06"] } });
    expect(delaySummary(t, "2026-06")).toEqual({
      carriedMonths: 0,
      earliestMonth: null,
      dismissedDate: null,
    });
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/lib/tasks.test.ts`
Expected: FAIL — `delaySummary` is not exported。

- [ ] **Step 3：實作**

加到 `src/lib/tasks.ts`（接在 `delayKind` 之後）：

```ts
export interface DelaySummary {
  carriedMonths: number;
  earliestMonth: string | null;
  dismissedDate: string | null;
}

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

/** The two conclusions the task-detail page shows: how long it has been
 * carried across months, and whether it was bounced off a day this month. */
export function delaySummary(t: Task, month: string): DelaySummary {
  const months = t.custom_fields.scheduled_months ?? [];
  const earlier = months.filter((m) => m < month);
  const earliestMonth = earlier.length ? earlier.reduce((a, b) => (a < b ? a : b)) : null;
  const carriedMonths = earliestMonth ? monthsBetween(earliestMonth, month) : 0;
  const u = t.custom_fields.unscheduled_at ?? "";
  const dismissedDate = u.startsWith(month) ? u : null;
  return { carriedMonths, earliestMonth, dismissedDate };
}
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/lib/tasks.test.ts`
Expected: PASS。

- [ ] **Step 5：commit**

```bash
git add src/lib/tasks.ts src/lib/tasks.test.ts
git commit -m "feat(tasks): add delaySummary for task-detail delay block

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3：MonthRow 雙色拖延點

**Files:**
- Modify: `src/features/month/MonthRow.tsx`
- Modify: `src/features/month/MonthRow.module.css`
- Test: `src/features/month/MonthRow.test.tsx`

**Interfaces:**
- Consumes: `delayKind(task, month)`（Task 1）。
- 行為：當 `kind === "primary"` 時，在 ring 與 title 之間畫一顆 `.dot`。未完成且有拖延 → 上色（`carried` 紅 / `dismissed` 琥珀）並掛 `title`；其餘 → 透明佔位點、無 `title`、`aria-hidden`。

- [ ] **Step 1：寫失敗測試**

加到 `src/features/month/MonthRow.test.tsx`：

```ts
it("shows a carried-over delay dot for a task scheduled in an earlier month", () => {
  useTasksStore.setState({
    tasks: [{ id: "c1", title: "延遲任務", status: "open", created_at: "x", updated_at: "x",
      custom_fields: { scheduled_months: ["2026-04", "2026-05"] } }],
    today: "2026-05-22", status: "ready", error: null,
  });
  render(<MonthRow task={useTasksStore.getState().tasks[0]} kind="primary"
    month="2026-05" selectedDate="2026-05-22" interactive showRing />);
  expect(screen.getByTitle("之前的月份就排了，一直拖到現在")).toBeInTheDocument();
});

it("shows a dismissed delay dot for a task bounced off a day this month", () => {
  useTasksStore.setState({
    tasks: [{ id: "c2", title: "落掉任務", status: "open", created_at: "x", updated_at: "x",
      custom_fields: { scheduled_months: ["2026-05"], unscheduled_at: "2026-05-10" } }],
    today: "2026-05-22", status: "ready", error: null,
  });
  render(<MonthRow task={useTasksStore.getState().tasks[0]} kind="primary"
    month="2026-05" selectedDate="2026-05-22" interactive showRing />);
  expect(screen.getByTitle("這個月排到某天卻沒做")).toBeInTheDocument();
});

it("shows no delay title for a fresh this-month task", () => {
  useTasksStore.setState({
    tasks: [{ id: "c3", title: "新任務", status: "open", created_at: "x", updated_at: "x",
      custom_fields: { scheduled_months: ["2026-05"] } }],
    today: "2026-05-22", status: "ready", error: null,
  });
  render(<MonthRow task={useTasksStore.getState().tasks[0]} kind="primary"
    month="2026-05" selectedDate="2026-05-22" interactive showRing />);
  expect(screen.queryByTitle(/排了|沒做/)).toBeNull();
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/features/month/MonthRow.test.tsx`
Expected: FAIL — 找不到對應 `title` 的元素。

- [ ] **Step 3：實作元件**

在 `src/features/month/MonthRow.tsx` 加 import：

```ts
import { delayKind } from "@/lib/tasks";
```

在 `MonthRow` 函式內、`return` 之前算出拖延（`isDone` 已存在）：

```ts
const delay = kind === "primary" && !isDone ? delayKind(task, month) : "none";
const delayTitle =
  delay === "carried"
    ? "之前的月份就排了，一直拖到現在"
    : delay === "dismissed"
      ? "這個月排到某天卻沒做"
      : undefined;
```

在 JSX 裡，於 ring 的 `Menu` 區塊之後、title 之前插入點（緊接在 `{showRing && editable && (...)}` 結束的 `)}` 後面、`{row.isEditing ? (` 之前）：

```tsx
{kind === "primary" && (
  <span
    className={[styles.dot, delay !== "none" && styles[delay]].filter(Boolean).join(" ")}
    title={delayTitle}
    aria-hidden={delay === "none" ? true : undefined}
  />
)}
```

- [ ] **Step 4：加樣式**

加到 `src/features/month/MonthRow.module.css`：

```css
.dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: transparent;
}
.carried {
  background: var(--color-flag, #c1432e);
}
.dismissed {
  background: var(--color-warn, #c98a1e);
}
```

- [ ] **Step 5：跑測試確認通過**

Run: `npx vitest run src/features/month/MonthRow.test.tsx`
Expected: PASS（含原有測試）。

- [ ] **Step 6：commit**

```bash
git add src/features/month/MonthRow.tsx src/features/month/MonthRow.module.css src/features/month/MonthRow.test.tsx
git commit -m "feat(month): two-color delay dot on undone month rows

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4：MonthColumn 合併計劃內 / 計劃外

**Files:**
- Modify: `src/features/month/MonthColumn.tsx`
- Test: `src/features/month/MonthColumn.test.tsx`

**Interfaces:**
- Consumes: `tasksOnMonth`（既有）、`MonthRow`（既有）。
- 行為：把原本 `otherPlanned`（計劃內）與 `adhoc`（計劃外）兩段合併成單一「其他任務」段；計劃外列仍由 `MonthRow` 依 `is_adhoc` 顯示 `UnplannedChip`（文字「+ 計劃外」）。

- [ ] **Step 1：寫失敗測試**

`MonthColumn.test.tsx` 用整個 router 渲染（見檔案上方 `renderInRouter` / `beforeEach`）。加一個 helper 與測試；seed 一個計劃內 + 一個計劃外月份任務：

```ts
it("merges 計劃內 and 計劃外 into a single 其他任務 list", async () => {
  useTasksStore.setState({
    tasks: [
      { id: "p1", title: "計劃內任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], is_adhoc: "false" } },
      { id: "p2", title: "計劃外任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], is_adhoc: "true" } },
    ],
    today: "2099-01-15", status: "ready", error: null,
  });
  renderInRouter("/plan/2099-01-15");
  await waitFor(() => expect(screen.getByText("其他任務")).toBeInTheDocument());
  expect(screen.getByText("計劃內任務")).toBeInTheDocument();
  expect(screen.getByText("計劃外任務")).toBeInTheDocument();
  expect(screen.getByText("+ 計劃外")).toBeInTheDocument();
  expect(screen.queryByText("其他計劃內")).toBeNull();
});
```

註：`beforeEach` 會把 store 重設為空，這個測試自己重設 store；`renderInRouter` 內的 fetch 已被 mock 成 401，元件改吃 store 既有資料。

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/features/month/MonthColumn.test.tsx`
Expected: FAIL — 找不到「其他任務」（目前只有「其他計劃內」「計劃外」）。

- [ ] **Step 3：實作**

在 `src/features/month/MonthColumn.tsx`，把現有的 `otherPlanned` / `adhoc` 兩個變數與其兩段 JSX 換掉。

刪除這兩段變數宣告：

```ts
const otherPlanned = primary.filter(
  (e) => !e.task.custom_fields.monthly_priority && e.task.custom_fields.is_adhoc !== "true",
);
const adhoc = primary.filter(
  (e) => !e.task.custom_fields.monthly_priority && e.task.custom_fields.is_adhoc === "true",
);
```

換成：

```ts
const others = primary.filter((e) => !e.task.custom_fields.monthly_priority);
```

把 `nothing` 改成用 `others`：

```ts
const nothing = top3.length === 0 && others.length === 0 && trails.length === 0;
```

刪掉原本「其他計劃內」與「計劃外」兩個 `<section>`（`{otherPlanned.length > 0 && (...)}` 與 `{adhoc.length > 0 && (...)}`），改成單一段：

```tsx
{others.length > 0 && (
  <section className={styles.section}>
    <header className={styles.sectionHead}>其他任務</header>
    {others.map((e) => (
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
  </section>
)}
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/features/month/MonthColumn.test.tsx`
Expected: PASS。

- [ ] **Step 5：commit**

```bash
git add src/features/month/MonthColumn.tsx src/features/month/MonthColumn.test.tsx
git commit -m "feat(month): merge 計劃內/計劃外 into one 其他任務 list

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5：MonthColumn 已完成摺疊群組

**Files:**
- Modify: `src/features/month/MonthColumn.tsx`
- Modify: `src/features/month/MonthColumn.module.css`
- Test: `src/features/month/MonthColumn.test.tsx`

**Interfaces:**
- Consumes: Task 4 的 `others`。
- 行為：把 `others` 拆成未完成（直接列）與已完成（收進 `▸ 已完成 (N)` 群組，預設收合，按鈕切換）。用 `useState` 控制展開（不用原生 `<details>`，因 jsdom 無法可靠判定其收合可見性）。

- [ ] **Step 1：寫失敗測試**

加到 `src/features/month/MonthColumn.test.tsx`（`userEvent` 需在檔案頂引入：`import userEvent from "@testing-library/user-event";`，若尚未引入則一併加上）：

```ts
it("collapses completed tasks into a 已完成 group, expandable on click", async () => {
  useTasksStore.setState({
    tasks: [
      { id: "u1", title: "未完成任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], is_adhoc: "false" } },
      { id: "d1", title: "已完成任務", status: "done", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], is_adhoc: "false" } },
    ],
    today: "2099-01-15", status: "ready", error: null,
  });
  renderInRouter("/plan/2099-01-15");
  await waitFor(() => expect(screen.getByText("未完成任務")).toBeInTheDocument());

  // Done task is hidden until the group is expanded.
  expect(screen.queryByText("已完成任務")).toBeNull();
  const toggle = screen.getByRole("button", { name: /已完成 \(1\)/ });
  await userEvent.click(toggle);
  expect(screen.getByText("已完成任務")).toBeInTheDocument();
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/features/month/MonthColumn.test.tsx`
Expected: FAIL — 找不到「已完成 (1)」按鈕（done 目前直接列在清單裡）。

- [ ] **Step 3：實作**

在 `src/features/month/MonthColumn.tsx`，把 `useMemo` 的 import 補上 `useState`：

```ts
import { useMemo, useState } from "react";
```

在 `others` 之後加拆分與展開狀態：

```ts
const undoneOthers = others.filter((e) => e.task.status !== "done");
const doneOthers = others.filter((e) => e.task.status === "done");
const [showDone, setShowDone] = useState(false);
```

把 Task 4 的「其他任務」段內容改成「未完成直接列 + 已完成摺疊」：

```tsx
{others.length > 0 && (
  <section className={styles.section}>
    <header className={styles.sectionHead}>其他任務</header>
    {undoneOthers.map((e) => (
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
    {doneOthers.length > 0 && (
      <div className={styles.doneGroup}>
        <button
          type="button"
          className={styles.doneToggle}
          aria-expanded={showDone}
          onClick={() => setShowDone((v) => !v)}
        >
          {showDone ? "▾" : "▸"} 已完成 ({doneOthers.length})
        </button>
        {showDone &&
          doneOthers.map((e) => (
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
      </div>
    )}
  </section>
)}
```

- [ ] **Step 4：加樣式**

加到 `src/features/month/MonthColumn.module.css`：

```css
.doneGroup {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.doneToggle {
  align-self: flex-start;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  color: var(--color-ink-faint);
  padding: var(--space-2) 0;
}
.doneToggle:hover {
  color: var(--color-ink-soft);
}
```

- [ ] **Step 5：跑測試確認通過**

Run: `npx vitest run src/features/month/MonthColumn.test.tsx`
Expected: PASS。

- [ ] **Step 6：commit**

```bash
git add src/features/month/MonthColumn.tsx src/features/month/MonthColumn.module.css src/features/month/MonthColumn.test.tsx
git commit -m "feat(month): collapse completed tasks into a 已完成 group

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6：詳情頁「拖延狀況」摘要

**Files:**
- Modify: `src/features/task-detail/TaskDetailModal.tsx`
- Modify: `src/features/task-detail/TaskDetailModal.module.css`
- Test: `src/features/task-detail/TaskDetailModal.test.tsx`

**Interfaces:**
- Consumes: `primaryMonth`（既有）、`delaySummary`（Task 2）。
- 行為：對有拖延的任務，在 chips 之後、描述之前顯示「拖延狀況」區塊；無拖延則不顯示。

- [ ] **Step 1：寫失敗測試**

加到 `src/features/task-detail/TaskDetailModal.test.tsx` 的 `describe` 內：

```ts
it("shows a delay block for a carried-over task", () => {
  useTasksStore.setState({
    tasks: [{ id: "dly", title: "延遲任務", status: "open", created_at: "", updated_at: "",
      custom_fields: { scheduled_months: ["2026-04", "2026-06"] }, subtask_count: 0 }],
    status: "ready", error: null, recentlyDeleted: null,
  });
  useTaskDetailStore.setState({ openId: "dly" });
  render(<TaskDetailModal />);
  expect(screen.getByText(/跨月拖延 2 個月/)).toBeInTheDocument();
});

it("shows no delay block for a fresh this-month task", () => {
  useTasksStore.setState({
    tasks: [{ id: "fresh", title: "新任務", status: "open", created_at: "", updated_at: "",
      custom_fields: { scheduled_months: ["2026-06"] }, subtask_count: 0 }],
    status: "ready", error: null, recentlyDeleted: null,
  });
  useTaskDetailStore.setState({ openId: "fresh" });
  render(<TaskDetailModal />);
  expect(screen.queryByText("拖延狀況")).toBeNull();
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/features/task-detail/TaskDetailModal.test.tsx`
Expected: FAIL — 找不到「跨月拖延 2 個月」。

- [ ] **Step 3：實作元件**

在 `src/features/task-detail/TaskDetailModal.tsx` 補 import：

```ts
import { primaryMonth, delaySummary } from "@/lib/tasks";
```

在 `const open = Boolean(openId && task);` 之後算出摘要：

```ts
const delayMonth = task ? primaryMonth(task) : null;
const delay = task && delayMonth ? delaySummary(task, delayMonth) : null;
const hasDelay = Boolean(delay && (delay.carriedMonths > 0 || delay.dismissedDate));
```

在 JSX 的 `<div className={styles.chips}>...</div>` 結束之後、`描述` 的 `<section>` 之前插入：

```tsx
{hasDelay && delay && (
  <section className={styles.section}>
    <div className={styles.label}>拖延狀況</div>
    {delay.carriedMonths > 0 && (
      <p className={styles.delayLine}>
        🔴 跨月拖延 {delay.carriedMonths} 個月 · {delay.earliestMonth} 就排了
      </p>
    )}
    {delay.dismissedDate && (
      <p className={styles.delayLine}>🟡 本月排到某天沒做 · {delay.dismissedDate.slice(5)}</p>
    )}
  </section>
)}
```

- [ ] **Step 4：加樣式**

加到 `src/features/task-detail/TaskDetailModal.module.css`：

```css
.delayLine { font-size: 13px; color: var(--color-ink-soft); margin: 0 0 6px; }
```

- [ ] **Step 5：跑測試確認通過**

Run: `npx vitest run src/features/task-detail/TaskDetailModal.test.tsx`
Expected: PASS。

- [ ] **Step 6：commit**

```bash
git add src/features/task-detail/TaskDetailModal.tsx src/features/task-detail/TaskDetailModal.module.css src/features/task-detail/TaskDetailModal.test.tsx
git commit -m "feat(task-detail): add delay summary block

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7：e2e（seed + 摺疊與拖延點）

**Files:**
- Modify: `e2e/fixtures/wspc-fake.ts`
- Modify: `e2e/plan-interaction.spec.ts`

**Interfaces:**
- Consumes: 前面所有 UI 改動。
- seed 加兩筆當月任務：一筆已完成（測摺疊）、一筆跨月延遲（測拖延點）。

- [ ] **Step 1：擴充 seed**

在 `e2e/fixtures/wspc-fake.ts` 的 `seed()` 內，`const month = today.slice(0, 7);` 之後、`todos.push(` 月份任務那段裡，先算出上個月，再多 push 兩筆。把現有的 `todos.push( {pm1...}, {pm2...} );` 擴成：

```ts
const month = today.slice(0, 7);
const [py, pm] = month.split("-").map(Number);
const prevIdx = py * 12 + (pm - 1) - 1;
const prevMonth = `${Math.floor(prevIdx / 12)}-${String((prevIdx % 12) + 1).padStart(2, "0")}`;
todos.push(
  {
    id: "pm1",
    project_id: PROJECT_ID,
    type_id: TYPE_ID,
    status: "open",
    title: "本月最重要的事 A",
    created_at: base,
    updated_at: base,
    custom_fields: { scheduled_months: [month], monthly_priority: "1", is_adhoc: "false" },
  },
  {
    id: "pm2",
    project_id: PROJECT_ID,
    type_id: TYPE_ID,
    status: "open",
    title: "本月其他計畫 B",
    created_at: base,
    updated_at: base,
    custom_fields: { scheduled_months: [month], is_adhoc: "false" },
  },
  {
    id: "pm3",
    project_id: PROJECT_ID,
    type_id: TYPE_ID,
    status: "done",
    title: "本月已完成 C",
    created_at: base,
    updated_at: base,
    custom_fields: { scheduled_months: [month], is_adhoc: "false", done_on: `${today}T08:00:00Z` },
  },
  {
    id: "pm4",
    project_id: PROJECT_ID,
    type_id: TYPE_ID,
    status: "open",
    title: "本月延遲 D",
    created_at: base,
    updated_at: base,
    custom_fields: { scheduled_months: [prevMonth, month], is_adhoc: "false" },
  },
);
```

- [ ] **Step 2：加 e2e 測試**

加到 `e2e/plan-interaction.spec.ts` 末尾：

```ts
test("completed month tasks collapse into a 已完成 group, expandable on click", async ({ page }) => {
  // "本月已完成 C" is a done month task — hidden until the 已完成 group is expanded.
  await expect(page.getByText("本月已完成 C")).toBeHidden();
  const toggle = page.getByRole("button", { name: /已完成 \(\d+\)/ });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.getByText("本月已完成 C")).toBeVisible();
});

test("a carried-over month task shows a delay dot", async ({ page }) => {
  // "本月延遲 D" was scheduled in the previous month too → carried delay marker.
  await expect(page.getByText("本月延遲 D")).toBeVisible();
  await expect(page.getByTitle("之前的月份就排了，一直拖到現在")).toBeVisible();
});
```

- [ ] **Step 3：停掉 preview dev server（若有在跑），跑 e2e**

Run: `npm run test:e2e -- plan-interaction`
Expected: 全綠，含新兩個測試。若 Windows 上跑不起來，確認 `playwright.config.ts` 用 `127.0.0.1`（既有設定）。

- [ ] **Step 4：跑完整單元測試 + 型別檢查**

Run: `npx vitest run`
Expected: 全綠。

Run: `npm run build`
Expected: 型別檢查通過、build 成功。

- [ ] **Step 5：commit**

```bash
git add e2e/fixtures/wspc-fake.ts e2e/plan-interaction.spec.ts
git commit -m "test(e2e): month list collapse + carried-over delay dot

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8：手動驗收 + 產生驗收報告

**Files:**
- Create: `docs/acceptance-reports/month-list-redesign/`（gitignored；截圖在底下 `assets/`）

依 [.claude/rules/acceptance-report.md](../../../.claude/rules/acceptance-report.md) 的格式與 playwright-cli 截圖落地流程執行。

- [ ] **Step 1：啟動 preview 並探登入狀態**

用共用 profile 開：`playwright-cli open --persistent --profile ~/.desk-dev/pw-profile <preview-url>/plan`。看是否已登入（header 顯示帳號）。已登入直接驗收；未登入才請使用者協助走一次 device flow。

> ⚠️ 一次只跑一個 worktree 的 dev server；跑 preview 前先確認沒有 e2e 的 dev server 還開著。

- [ ] **Step 2：逐項對照 spec 的驗收標準手動驗收**

對照 [spec 驗收標準](../specs/2026-06-21-month-list-redesign-design.md)：
1. 已完成預設收合成 `▸ 已完成 (N)`，可展開。
2. top3 永遠展開、含完成狀態。
3. 計劃內/計劃外合併成一條「其他任務」，計劃外仍有「+ 計劃外」tag。
4. 跨月延遲列有 🔴 點、本月排過沒做有 🟡 點、無拖延為透明佔位且標題對齊；hover 出現短說明。
5. 點進有拖延的任務，詳情頁顯示「拖延狀況」摘要；無拖延不顯示。
6. 月份欄整體高度明顯縮短。

每項用 `playwright-cli screenshot --filename docs/acceptance-reports/month-list-redesign/assets/<name>.png` 落地截圖。

- [ ] **Step 3：寫報告**

把結果寫到 `docs/acceptance-reports/month-list-redesign/README.md`（格式見 acceptance-report.md 範本），每項標 PASS/FAIL 並引對應截圖。

- [ ] **Step 4：回報**

把報告路徑與 PASS/FAIL 總結回報給使用者。報告為 gitignored，不 commit。

---

## 自我檢查

**Spec 覆蓋：**
- 摺疊已完成 → Task 5；合併計劃內/計劃外 → Task 4；top3 不收合 → 沿用既有 `MonthHeroCard`，Task 4/5 未動它。
- 雙色拖延點（🔴 跨月 / 🟡 本月排過）→ Task 1（判定）+ Task 3（渲染）；透明佔位對齊 → Task 3。
- 詳情頁排程軌跡（兩個結論）→ Task 2（衍生）+ Task 6（渲染）。
- 純前端、不改 schema → 全部任務只動前端衍生與元件。
- `npm run build` / `vitest` / `test:e2e` 通過 → Task 7 Step 3-4。
- 刻意不做（排序、trails、WEEK/DAY）→ 計畫未涉及，符合。

**Placeholder 掃描：** 無 TBD / TODO；每個 code step 都有完整程式碼。

**型別一致性：** `DelayKind` / `delayKind` / `DelaySummary` / `delaySummary` 在 Task 1-2 定義，Task 3/6 以相同名稱與型別消費；`others` / `undoneOthers` / `doneOthers` / `showDone` 在 Task 4-5 一致。
