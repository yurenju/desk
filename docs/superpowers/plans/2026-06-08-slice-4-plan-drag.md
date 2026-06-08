# Slice 4 — Plan 模式完整拖曳 + Backlog 互動 實作計畫

> **給代理工作者：** 必要 SUB-SKILL：用 superpowers:subagent-driven-development（建議）或 superpowers:executing-plans 一個任務一個任務執行。步驟用 checkbox（`- [ ]`）追蹤。

**目標：** 在 Plan 模式裡讓 Backlog / 月 / 日 / 週的任務都能拖曳重排（桌機）或用 `⋯` menu promote（手機 + 桌機），並讓 backlog 從唯讀變可寫。

**架構：** 純資料層 op（`taskOps.ts`）→ store action（樂觀更新 + patch queue）→ 元件（`BacklogRow` / `AddBacklogTaskInput`）→ `@dnd-kit/core` 拖曳基礎建設（`DndContext` 在 `PlanLayout`、用 React context 控制桌機才啟用）→ 各欄掛 draggable / droppable → e2e + 手動驗收。Plan 拖曳的核心語意是 `planScheduleDay`：已排某天的 task 重排時**替換 `scheduled_dates` 最後一筆**（乾淨、不留軌跡），否則 append。

**技術棧：** React 18 + TS、Zustand、TanStack Router、`@dnd-kit/core`、Vitest + Testing Library、Playwright。

設計文件：[2026-06-08-slice-4-plan-drag-design.md](../specs/2026-06-08-slice-4-plan-drag-design.md)

---

## 檔案結構

**新增：**
- `src/features/backlog/BacklogRow.tsx` + `useBacklogRow.ts` + `BacklogRow.module.css`：backlog 列（完成 / 編輯 / 刪除 / promote menu / 可拖曳）。
- `src/features/backlog/AddBacklogTaskInput.tsx` + `.module.css`：新增 backlog 任務輸入框。
- `src/features/plan-view/dnd.ts`：drop target 型別 + `dropId` / `parseDropId`（純函式）。
- `src/features/plan-view/dragContext.tsx`：`DragEnabledProvider` + `useDragEnabled`。
- `src/features/plan-view/useDraggableRow.ts`：包 `useDraggable`，桌機才掛 listeners。
- `src/features/plan-view/useDroppableZone.ts`：包 `useDroppable`。
- `src/lib/useHoverCapable.ts`：`(hover: hover)` 偵測 hook（jsdom 無 matchMedia 時回 false）。

**修改：**
- `src/lib/date.ts`：加 `monthOf`。
- `src/lib/tasks.ts`：加 `nextFreeDailySlot`。
- `src/store/taskOps.ts`：加 `addBacklogTask`、`promoteToMonth`、`planScheduleDay`。
- `src/store/tasks.ts`：加對應 store action。
- `src/features/backlog/BacklogSection.tsx`：改用 `BacklogRow` + `AddBacklogTaskInput`。
- `src/features/plan-view/PlanLayout.tsx`：`DndContext` + `DragOverlay` + `onDragEnd`。
- `src/features/month/MonthRow.tsx`、`MonthHeroCard.tsx`、`useMonthRow.ts`：promote 改用 `planScheduleDay`；列掛 draggable。
- `src/features/day/TaskRow.tsx`、`Top3Card.tsx`：列掛 draggable；Day 欄掛 droppable 子區。
- `src/features/week/WeekColumn.tsx`：日格 task 掛 draggable、日格掛 droppable 子區。
- `src/features/month/MonthColumn.tsx`、`DayColumn.tsx`：包 droppable 區塊。
- `e2e/plan-interaction.spec.ts`：加 backlog promote + 拖曳測試。

---

## Task 1：`monthOf` date helper

**Files:**
- Modify: `src/lib/date.ts`
- Test: `src/lib/date.test.ts`

- [ ] **Step 1：寫失敗測試**

在 `src/lib/date.test.ts` 末尾加入（先確認檔案頂部已 `import { ... } from "./date"`，把 `monthOf` 加進 import）：

```ts
describe("monthOf", () => {
  it("extracts YYYY-MM from a YYYY-MM-DD date", () => {
    expect(monthOf("2026-06-08")).toBe("2026-06");
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/lib/date.test.ts -t monthOf`
Expected: FAIL（`monthOf is not a function`）

- [ ] **Step 3：實作**

在 `src/lib/date.ts` 末尾加：

```ts
/** Returns the YYYY-MM month of a YYYY-MM-DD date. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/lib/date.test.ts -t monthOf`
Expected: PASS

- [ ] **Step 5：commit**

```bash
git add src/lib/date.ts src/lib/date.test.ts
git commit -m "feat(date): add monthOf helper"
```

---

## Task 2：`nextFreeDailySlot` 純函式

**Files:**
- Modify: `src/lib/tasks.ts`
- Test: `src/lib/tasks.test.ts`

- [ ] **Step 1：寫失敗測試**

在 `src/lib/tasks.test.ts` 末尾加入（把 `nextFreeDailySlot` 加進頂部 import）：

```ts
describe("nextFreeDailySlot", () => {
  const onDay = (id: string, p?: "1" | "2" | "3"): Task => ({
    id, title: id, status: "open", created_at: "x", updated_at: "x",
    custom_fields: { scheduled_dates: ["2026-06-08"], ...(p ? { daily_priority: p } : {}) },
  });

  it("returns 1 when the day has no prioritised tasks", () => {
    expect(nextFreeDailySlot([onDay("a")], "2026-06-08")).toBe("1");
  });

  it("returns the first free slot", () => {
    expect(nextFreeDailySlot([onDay("a", "1"), onDay("b", "3")], "2026-06-08")).toBe("2");
  });

  it("returns 3 (evict) when all three slots are taken", () => {
    expect(
      nextFreeDailySlot([onDay("a", "1"), onDay("b", "2"), onDay("c", "3")], "2026-06-08"),
    ).toBe("3");
  });

  it("ignores tasks not primary on that day", () => {
    const other: Task = {
      id: "x", title: "x", status: "open", created_at: "x", updated_at: "x",
      custom_fields: { scheduled_dates: ["2026-06-09"], daily_priority: "1" },
    };
    expect(nextFreeDailySlot([other], "2026-06-08")).toBe("1");
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/lib/tasks.test.ts -t nextFreeDailySlot`
Expected: FAIL（`nextFreeDailySlot is not a function`）

- [ ] **Step 3：實作**

在 `src/lib/tasks.ts` 末尾加（`Priority` 已可從 `./types` import，確認頂部 import 有帶上）：

```ts
import type { Task, TaskWithTrail, Layer, TrailKind, Priority } from "./types";
// ^ 把 Priority 併進現有 import；下面是新函式

/**
 * The first free daily_priority slot (1→2→3) among tasks primary on `date`.
 * Returns "3" when all three are taken, so the caller's setDailyPriority can
 * evict slot 3's current occupant (同 day ring 擲位語意).
 */
export function nextFreeDailySlot(all: Task[], date: string): Priority {
  const taken = new Set(
    all
      .filter((t) => primaryDate(t) === date && t.custom_fields.daily_priority)
      .map((t) => t.custom_fields.daily_priority),
  );
  if (!taken.has("1")) return "1";
  if (!taken.has("2")) return "2";
  return "3";
}
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/lib/tasks.test.ts -t nextFreeDailySlot`
Expected: PASS

- [ ] **Step 5：commit**

```bash
git add src/lib/tasks.ts src/lib/tasks.test.ts
git commit -m "feat(tasks): add nextFreeDailySlot derivation"
```

---

## Task 3：`addBacklogTask` op

**Files:**
- Modify: `src/store/taskOps.ts`
- Test: `src/store/taskOps.test.ts`

- [ ] **Step 1：寫失敗測試**

在 `src/store/taskOps.test.ts` 末尾加（把 `addBacklogTask` 加進頂部 import）：

```ts
describe("addBacklogTask", () => {
  it("appends a backlog task with empty scheduled_* and is_adhoc false", () => {
    const next = addBacklogTask([], "讀一本書", "tmp", NOW);
    expect(next).toHaveLength(1);
    expect(next[0].custom_fields.scheduled_months).toEqual([]);
    expect(next[0].custom_fields.scheduled_dates).toEqual([]);
    expect(next[0].custom_fields.is_adhoc).toBe("false");
  });

  it("ignores blank titles", () => {
    expect(addBacklogTask([], "   ", "tmp", NOW)).toEqual([]);
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/store/taskOps.test.ts -t addBacklogTask`
Expected: FAIL

- [ ] **Step 3：實作**

在 `src/store/taskOps.ts` 末尾加：

```ts
export function addBacklogTask(tasks: Task[], title: string, id: string, now: string): Task[] {
  const trimmed = title.trim();
  if (!trimmed) return tasks;
  const task: Task = {
    id,
    title: trimmed,
    status: "open",
    created_at: now,
    updated_at: now,
    custom_fields: { scheduled_months: [], scheduled_dates: [], is_adhoc: "false" },
  };
  return [...tasks, task];
}
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/store/taskOps.test.ts -t addBacklogTask`
Expected: PASS

- [ ] **Step 5：commit**

```bash
git add src/store/taskOps.ts src/store/taskOps.test.ts
git commit -m "feat(taskOps): add addBacklogTask"
```

---

## Task 4：`promoteToMonth` op

**Files:**
- Modify: `src/store/taskOps.ts`
- Test: `src/store/taskOps.test.ts`

- [ ] **Step 1：寫失敗測試**

```ts
describe("promoteToMonth", () => {
  it("appends the month to scheduled_months", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_months: [] } })];
    const next = promoteToMonth(tasks, "a", "2026-06");
    expect(next[0].custom_fields.scheduled_months).toEqual(["2026-06"]);
  });

  it("is a no-op (same ref) when the month is already the last entry", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_months: ["2026-06"] } })];
    expect(promoteToMonth(tasks, "a", "2026-06")).toBe(tasks);
  });
});
```

加 `promoteToMonth` 到頂部 import。

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/store/taskOps.test.ts -t promoteToMonth`
Expected: FAIL

- [ ] **Step 3：實作**

在 `src/store/taskOps.ts` 加：

```ts
export function promoteToMonth(tasks: Task[], id: string, month: string): Task[] {
  if (!tasks.some((t) => t.id === id)) return tasks;
  const target = tasks.find((t) => t.id === id)!;
  const months = target.custom_fields.scheduled_months ?? [];
  if (months[months.length - 1] === month) return tasks; // already there
  return tasks.map((t) =>
    t.id === id ? patch(t, { scheduled_months: [...months, month] }) : t,
  );
}
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/store/taskOps.test.ts -t promoteToMonth`
Expected: PASS

- [ ] **Step 5：commit**

```bash
git add src/store/taskOps.ts src/store/taskOps.test.ts
git commit -m "feat(taskOps): add promoteToMonth"
```

---

## Task 5：`planScheduleDay` op（核心）

**Files:**
- Modify: `src/store/taskOps.ts`
- Test: `src/store/taskOps.test.ts`

- [ ] **Step 1：寫失敗測試**

```ts
describe("planScheduleDay", () => {
  it("appends the date when the task has no primary date (first placement)", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_months: ["2026-06"] } })];
    const next = planScheduleDay(tasks, "a", "2026-06-08");
    expect(next[0].custom_fields.scheduled_dates).toEqual(["2026-06-08"]);
  });

  it("backfills the month when scheduling a backlog task to a day", () => {
    const tasks = [makeTask({ id: "a", custom_fields: {} })];
    const next = planScheduleDay(tasks, "a", "2026-06-08");
    expect(next[0].custom_fields.scheduled_dates).toEqual(["2026-06-08"]);
    expect(next[0].custom_fields.scheduled_months).toEqual(["2026-06"]);
  });

  it("replaces the last date when re-planning a task already on a day", () => {
    const tasks = [
      makeTask({
        id: "a",
        custom_fields: { scheduled_months: ["2026-06"], scheduled_dates: ["2026-06-08"] },
      }),
    ];
    const next = planScheduleDay(tasks, "a", "2026-06-10");
    expect(next[0].custom_fields.scheduled_dates).toEqual(["2026-06-10"]);
  });

  it("preserves earlier trail entries when re-planning the current placement", () => {
    const tasks = [
      makeTask({
        id: "a",
        custom_fields: {
          scheduled_months: ["2026-06"],
          scheduled_dates: ["2026-06-01", "2026-06-08"], // 06-01 是真實順延軌跡
        },
      }),
    ];
    const next = planScheduleDay(tasks, "a", "2026-06-10");
    expect(next[0].custom_fields.scheduled_dates).toEqual(["2026-06-01", "2026-06-10"]);
  });

  it("is a no-op (same ref) when re-planning to the date already last", () => {
    const tasks = [
      makeTask({
        id: "a",
        custom_fields: { scheduled_months: ["2026-06"], scheduled_dates: ["2026-06-08"] },
      }),
    ];
    expect(planScheduleDay(tasks, "a", "2026-06-08")).toBe(tasks);
  });
});
```

頂部 import 加 `planScheduleDay`。`taskOps.ts` 頂部已 `import { primaryDate, primaryMonth } from "@/lib/tasks"`；再加 `monthOf`：把 `import { monthOf } from "@/lib/date";` 加到 `taskOps.ts` 頂部。

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/store/taskOps.test.ts -t planScheduleDay`
Expected: FAIL

- [ ] **Step 3：實作**

在 `src/store/taskOps.ts` 加：

```ts
export function planScheduleDay(tasks: Task[], id: string, date: string): Task[] {
  if (!tasks.some((t) => t.id === id)) return tasks;
  const month = monthOf(date);
  return tasks.map((t) => {
    if (t.id !== id) return t;
    const dates = t.custom_fields.scheduled_dates ?? [];
    const hasPrimaryDate = primaryDate(t) !== null;

    let nextDates: string[];
    if (dates[dates.length - 1] === date) {
      nextDates = dates; // already current
    } else if (hasPrimaryDate) {
      // re-plan: replace the current (last) entry, keep earlier trail entries
      nextDates = [...dates.slice(0, -1), date];
    } else {
      // first day placement
      nextDates = [...dates, date];
    }

    const months = t.custom_fields.scheduled_months ?? [];
    const nextMonths = primaryMonth(t) === month ? months : [...months, month];

    if (nextDates === dates && nextMonths === months) return t;
    return patch(t, { scheduled_dates: nextDates, scheduled_months: nextMonths });
  });
}
```

> 注意「no-op 回 same ref」：當 `nextDates === dates`（同一參考）且月份未補時，回傳原 `t`，外層 `.map` 仍產生新陣列。為了讓 `planScheduleDay(...) === tasks` 成立（測試最後一例），需在 op 末尾加一個整體短路。修正版見 Step 3b。

- [ ] **Step 3b：補整體短路（讓未變更時回原陣列參考）**

把上面實作改成先算出是否有任何變更，無變更回原 `tasks`：

```ts
export function planScheduleDay(tasks: Task[], id: string, date: string): Task[] {
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;
  const month = monthOf(date);
  const dates = target.custom_fields.scheduled_dates ?? [];
  const hasPrimaryDate = primaryDate(target) !== null;

  let nextDates: string[];
  if (dates[dates.length - 1] === date) nextDates = dates;
  else if (hasPrimaryDate) nextDates = [...dates.slice(0, -1), date];
  else nextDates = [...dates, date];

  const months = target.custom_fields.scheduled_months ?? [];
  const nextMonths = primaryMonth(target) === month ? months : [...months, month];

  if (nextDates === dates && nextMonths === months) return tasks; // no change

  return tasks.map((t) =>
    t.id === id ? patch(t, { scheduled_dates: nextDates, scheduled_months: nextMonths }) : t,
  );
}
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/store/taskOps.test.ts -t planScheduleDay`
Expected: PASS（5 例全過）

- [ ] **Step 5：commit**

```bash
git add src/store/taskOps.ts src/store/taskOps.test.ts
git commit -m "feat(taskOps): add planScheduleDay (clean re-plan with month backfill)"
```

---

## Task 6：store action（addBacklogTask / promoteToMonth / planScheduleDay）

**Files:**
- Modify: `src/store/tasks.ts`
- Test: `src/store/tasks.test.ts`

- [ ] **Step 1：寫失敗測試**

在 `src/store/tasks.test.ts` 末尾加（沿用該檔既有 mock 樣式——參考檔內現有測試怎麼 spy `api`；以下用 `postTodo` / `patchTodoApi` mock）：

```ts
describe("planScheduleDay action", () => {
  it("optimistically schedules a backlog task to a day and backfills the month", async () => {
    vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    useTasksStore.setState({
      tasks: [{
        id: "a", title: "t", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: [], scheduled_dates: [] },
      }],
      status: "ready", error: null,
    });
    await useTasksStore.getState().planScheduleDay("a", "2026-06-08");
    const t = useTasksStore.getState().tasks.find((x) => x.id === "a")!;
    expect(t.custom_fields.scheduled_dates).toEqual(["2026-06-08"]);
    expect(t.custom_fields.scheduled_months).toEqual(["2026-06"]);
  });
});

describe("promoteToMonth action", () => {
  it("optimistically appends the month", async () => {
    vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    useTasksStore.setState({
      tasks: [{
        id: "a", title: "t", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: [] },
      }],
      status: "ready", error: null,
    });
    await useTasksStore.getState().promoteToMonth("a", "2026-06");
    expect(
      useTasksStore.getState().tasks.find((x) => x.id === "a")!.custom_fields.scheduled_months,
    ).toEqual(["2026-06"]);
  });
});

describe("addBacklogTask action", () => {
  it("creates a backlog task via postTodo", async () => {
    vi.spyOn(api, "postTodo").mockResolvedValue({
      id: "srv", title: "讀一本書", status: "open", created_at: "x", updated_at: "x",
      custom_fields: { scheduled_months: [], scheduled_dates: [], is_adhoc: "false" },
    });
    useTasksStore.setState({ tasks: [], status: "ready", error: null });
    await useTasksStore.getState().addBacklogTask("讀一本書");
    expect(useTasksStore.getState().tasks.some((t) => t.id === "srv")).toBe(true);
  });
});
```

> 確認檔頂部有 `import * as api from "@/lib/api/todo";` 與 `import { vi } from "vitest";`（看現有測試即知；若無就補）。`patchTodoApi` 是 `enqueuePatch` 底層呼叫的 API；mock 它即可避免真實 fetch。

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/store/tasks.test.ts -t "planScheduleDay action"`
Expected: FAIL（store 無此 action）

- [ ] **Step 3：實作 store action**

在 `src/store/tasks.ts`：

(a) 頂部 import 補上新 op：

```ts
import {
  addTodayTask,
  addMonthTask as addMonthTaskOp,
  addBacklogTask as addBacklogTaskOp,
  promoteToMonth as promoteToMonthOp,
  planScheduleDay as planScheduleDayOp,
  deleteTask,
  editTitle,
  promoteToDay as promoteToDayOp,
  restoreTask as restoreTaskOp,
  setAdhoc as setAdhocOp,
  setDailyPriority,
  setMonthlyPriority as setMonthlyPriorityOp,
  toggleDone,
} from "./taskOps";
```

(b) `TasksState` interface 加三個簽名：

```ts
  addBacklogTask: (title: string) => Promise<void>;
  promoteToMonth: (id: string, month: string) => Promise<void>;
  planScheduleDay: (id: string, date: string) => Promise<void>;
```

(c) 在 `addMonthTask` action 後面加三個 action：

```ts
  async addBacklogTask(title) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const prev = get().tasks;
    const tempId = `temp-${crypto.randomUUID()}`;
    set({ tasks: addBacklogTaskOp(prev, trimmed, tempId, now()), error: null });
    try {
      const created = await postTodo({ title: trimmed, is_adhoc: "false" });
      set({ tasks: get().tasks.map((t) => (t.id === tempId ? created : t)) });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async promoteToMonth(id, month) {
    const prev = get().tasks;
    const next = promoteToMonthOp(prev, id, month);
    if (next === prev) return;
    set({ tasks: next, error: null });
    const updated = next.find((t) => t.id === id)!;
    try {
      await enqueuePatch(id, { scheduled_months: updated.custom_fields.scheduled_months });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async planScheduleDay(id, date) {
    const prev = get().tasks;
    const next = planScheduleDayOp(prev, id, date);
    if (next === prev) return;
    set({ tasks: next, error: null });
    const updated = next.find((t) => t.id === id)!;
    try {
      await enqueuePatch(id, {
        scheduled_dates: updated.custom_fields.scheduled_dates,
        scheduled_months: updated.custom_fields.scheduled_months,
      });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/store/tasks.test.ts`
Expected: PASS

- [ ] **Step 5：commit**

```bash
git add src/store/tasks.ts src/store/tasks.test.ts
git commit -m "feat(store): add addBacklogTask / promoteToMonth / planScheduleDay actions"
```

---

## Task 7：`useBacklogRow` hook

**Files:**
- Create: `src/features/backlog/useBacklogRow.ts`
- Test: 由 Task 8 的 `BacklogRow.test.tsx` 一起涵蓋（hook 不單獨測）

- [ ] **Step 1：建立 hook**

```ts
import { useState } from "react";
import type { Priority } from "@/lib/types";
import { monthOf } from "@/lib/date";
import { useTasksStore } from "@/store/tasks";

export function useBacklogRow(id: string, opts: { focusDate: string }) {
  const toggleDone = useTasksStore((s) => s.toggleDone);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const editTitle = useTasksStore((s) => s.editTitle);
  const promoteToMonth = useTasksStore((s) => s.promoteToMonth);
  const planScheduleDay = useTasksStore((s) => s.planScheduleDay);
  const setDailyPriority = useTasksStore((s) => s.setDailyPriority);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  return {
    isEditing,
    draft,
    toggle: () => toggleDone(id),
    remove: () => deleteTask(id),
    toMonth: () => promoteToMonth(id, monthOf(opts.focusDate)),
    // Schedule onto the focus day. With a priority it also lands in that day's
    // top-3 (setDailyPriority evicts the slot's prior occupant); without one it
    // stays in the day's other-planned.
    toDay: (priority: Priority | null = null) => {
      planScheduleDay(id, opts.focusDate);
      if (priority) setDailyPriority(id, priority, opts.focusDate);
    },
    startEdit: (initial: string) => {
      setDraft(initial);
      setIsEditing(true);
    },
    changeDraft: (v: string) => setDraft(v),
    commitEdit: () => {
      editTitle(id, draft);
      setIsEditing(false);
    },
    cancelEdit: () => setIsEditing(false),
  };
}
```

- [ ] **Step 2：commit（與 Task 8 一起測；先 commit hook）**

```bash
git add src/features/backlog/useBacklogRow.ts
git commit -m "feat(backlog): add useBacklogRow hook"
```

---

## Task 8：`BacklogRow` 元件

**Files:**
- Create: `src/features/backlog/BacklogRow.tsx`, `BacklogRow.module.css`
- Test: `src/features/backlog/BacklogRow.test.tsx`

- [ ] **Step 1：寫失敗測試**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { BacklogRow } from "./BacklogRow";
import { useTasksStore } from "@/store/tasks";
import type { Task } from "@/lib/types";

function backlogTask(id: string): Task {
  return {
    id, title: `task-${id}`, status: "open", created_at: "x", updated_at: "x",
    custom_fields: { scheduled_months: [], scheduled_dates: [], is_adhoc: "false" },
  };
}

beforeEach(() => {
  useTasksStore.setState({ tasks: [backlogTask("a")], status: "ready", error: null });
});

describe("BacklogRow", () => {
  it("promotes to the focus day's top-3 via the menu", async () => {
    render(<BacklogRow task={backlogTask("a")} focusDate="2026-06-08" />);
    await userEvent.click(screen.getByRole("button", { name: "更多動作" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /· ① 三件事/ }));
    const t = useTasksStore.getState().tasks.find((x) => x.id === "a")!;
    expect(t.custom_fields.scheduled_dates).toEqual(["2026-06-08"]);
    expect(t.custom_fields.daily_priority).toBe("1");
  });

  it("promotes to the month via the menu", async () => {
    render(<BacklogRow task={backlogTask("a")} focusDate="2026-06-08" />);
    await userEvent.click(screen.getByRole("button", { name: "更多動作" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /→ 本月/ }));
    expect(
      useTasksStore.getState().tasks.find((x) => x.id === "a")!.custom_fields.scheduled_months,
    ).toEqual(["2026-06"]);
  });

  it("completes the task via the checkbox", async () => {
    render(<BacklogRow task={backlogTask("a")} focusDate="2026-06-08" />);
    await userEvent.click(screen.getByRole("checkbox", { name: "task-a" }));
    expect(useTasksStore.getState().tasks.find((x) => x.id === "a")!.status).toBe("done");
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/features/backlog/BacklogRow.test.tsx`
Expected: FAIL（找不到 `BacklogRow`）

- [ ] **Step 3：實作元件**

`src/features/backlog/BacklogRow.tsx`：

```tsx
import type { Task } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { Menu } from "@/ui/Menu";
import { useDraggableRow } from "@/features/plan-view/useDraggableRow";
import { useBacklogRow } from "./useBacklogRow";
import styles from "./BacklogRow.module.css";

export interface BacklogRowProps {
  task: Task;
  focusDate: string;
}

export function BacklogRow({ task, focusDate }: BacklogRowProps) {
  const isDone = task.status === "done";
  const row = useBacklogRow(task.id, { focusDate });
  const drag = useDraggableRow(task.id);
  const day = focusDate.slice(8);

  return (
    <div
      ref={drag.ref}
      className={[styles.row, isDone && styles.done, drag.isDragging && styles.dragging]
        .filter(Boolean)
        .join(" ")}
      {...drag.handleProps}
    >
      <Checkbox
        checked={isDone}
        disabled={isDone ? false : false}
        onCheckedChange={row.toggle}
        aria-label={task.title}
      />
      {row.isEditing ? (
        <input
          className={styles.editInput}
          autoFocus
          value={row.draft}
          onChange={(e) => row.changeDraft(e.target.value)}
          onBlur={row.cancelEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) row.commitEdit();
            if (e.key === "Escape") row.cancelEdit();
          }}
        />
      ) : (
        <span className={styles.title}>{task.title}</span>
      )}
      {!row.isEditing && (
        <div className={styles.actions}>
          <Menu
            ariaLabel="更多動作"
            trigger={
              <button type="button" className={styles.iconBtn} aria-label="更多動作">⋯</button>
            }
            items={[
              { key: "to-month", label: "→ 本月（其他計劃內）", onSelect: row.toMonth },
              { key: "to-day-1", label: `→ ${day} 日 · ① 三件事`, onSelect: () => row.toDay("1") },
              { key: "to-day-2", label: `→ ${day} 日 · ② 三件事`, onSelect: () => row.toDay("2") },
              { key: "to-day-3", label: `→ ${day} 日 · ③ 三件事`, onSelect: () => row.toDay("3") },
              { key: "to-day-other", label: `→ ${day} 日 · 其他`, onSelect: () => row.toDay() },
              { key: "edit", label: "編輯", onSelect: () => row.startEdit(task.title) },
              { key: "delete", label: "刪除", onSelect: row.remove, danger: true },
            ]}
          />
        </div>
      )}
    </div>
  );
}
```

> `Checkbox` 的 `disabled` 寫成 `false`（backlog 列永遠可勾）。上面那個三元式可直接寫 `disabled={false}`，保留是為了對齊既有列風格;實作時用 `disabled={false}` 即可。

`src/features/backlog/BacklogRow.module.css`（仿 `MonthRow.module.css` 的 row / title / actions / iconBtn / editInput；先複製 `MonthRow.module.css` 內容、移除 ring 相關 class，並加 `.dragging { opacity: 0.5; }`）：

```css
.row { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-1) 0; }
.row.done .title { text-decoration: line-through; opacity: 0.55; }
.title { flex: 1; font-size: var(--font-size-base); cursor: grab; }
.dragging { opacity: 0.5; }
.actions { margin-left: auto; }
.iconBtn { background: none; border: none; cursor: pointer; font-size: 1.1em; padding: var(--space-1); min-width: 44px; min-height: 44px; }
.editInput { flex: 1; font: inherit; }
```

> 上面 CSS 變數沿用專案 token；若某變數名與專案不符，照 `MonthRow.module.css` 既有命名調整。

- [ ] **Step 4：建立 `useDraggableRow` 的最小版（Task 10 會補完整 DnD；此處先給可編譯版）**

為了讓 `BacklogRow` 測試能跑（jsdom 無 DnD），先建 `src/features/plan-view/useDraggableRow.ts` 的最小骨架（Task 10/12 再接 dnd-kit）：

```ts
// Minimal stub — Task 10 wires this to @dnd-kit. Returns no-op props so rows
// render in jsdom without a DndContext.
export function useDraggableRow(_id: string) {
  return { ref: undefined as ((el: HTMLElement | null) => void) | undefined, handleProps: {}, isDragging: false };
}
```

- [ ] **Step 5：跑測試確認通過**

Run: `npx vitest run src/features/backlog/BacklogRow.test.tsx`
Expected: PASS

- [ ] **Step 6：commit**

```bash
git add src/features/backlog/BacklogRow.tsx src/features/backlog/BacklogRow.module.css src/features/backlog/BacklogRow.test.tsx src/features/plan-view/useDraggableRow.ts
git commit -m "feat(backlog): add BacklogRow with promote menu + complete/edit/delete"
```

---

## Task 9：`AddBacklogTaskInput` + `BacklogSection` 改寫

**Files:**
- Create: `src/features/backlog/AddBacklogTaskInput.tsx`, `AddBacklogTaskInput.module.css`
- Modify: `src/features/backlog/BacklogSection.tsx`
- Test: `src/features/backlog/AddBacklogTaskInput.test.tsx`

- [ ] **Step 1：寫失敗測試**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import { AddBacklogTaskInput } from "./AddBacklogTaskInput";
import { useTasksStore } from "@/store/tasks";
import * as api from "@/lib/api/todo";

it("adds a backlog task on Enter", async () => {
  vi.spyOn(api, "postTodo").mockResolvedValue({
    id: "srv", title: "someday", status: "open", created_at: "x", updated_at: "x",
    custom_fields: { scheduled_months: [], scheduled_dates: [], is_adhoc: "false" },
  });
  useTasksStore.setState({ tasks: [], status: "ready", error: null });
  render(<AddBacklogTaskInput />);
  const input = screen.getByLabelText("新增 backlog 任務");
  await userEvent.type(input, "someday{Enter}");
  expect(useTasksStore.getState().tasks.some((t) => t.title === "someday")).toBe(true);
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/features/backlog/AddBacklogTaskInput.test.tsx`
Expected: FAIL

- [ ] **Step 3：實作 input**

`src/features/backlog/AddBacklogTaskInput.tsx`（仿 `AddMonthTaskInput`）：

```tsx
import { useState } from "react";
import { useTasksStore } from "@/store/tasks";
import styles from "./AddBacklogTaskInput.module.css";

export function AddBacklogTaskInput() {
  const addBacklogTask = useTasksStore((s) => s.addBacklogTask);
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim()) {
      setValue("");
      return;
    }
    addBacklogTask(value);
    setValue("");
  };

  return (
    <div className={styles.bar}>
      <span className={styles.box} aria-hidden />
      <input
        className={styles.input}
        placeholder="+ 加一件想做但還沒排的事…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="新增 backlog 任務"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
        }}
      />
    </div>
  );
}
```

`src/features/backlog/AddBacklogTaskInput.module.css`：複製 `src/features/month/AddMonthTaskInput.module.css` 的內容即可（同樣 `.bar` / `.box` / `.input`）。

- [ ] **Step 4：改 `BacklogSection`**

把 `src/features/backlog/BacklogSection.tsx` 改為：

```tsx
import { useState } from "react";
import type { Task } from "@/lib/types";
import { tasksInBacklog } from "@/lib/tasks";
import { BacklogRow } from "./BacklogRow";
import { AddBacklogTaskInput } from "./AddBacklogTaskInput";
import styles from "./BacklogSection.module.css";

export interface BacklogSectionProps {
  allTasks: Task[];
  focusDate: string;
  defaultOpen?: boolean;
}

export function BacklogSection({ allTasks, focusDate, defaultOpen = false }: BacklogSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const items = tasksInBacklog(allTasks);

  return (
    <section className={styles.root}>
      <button
        type="button"
        className={styles.head}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.icon}>📥</span>
        <span className={styles.label}>Backlog</span>
        <span className={styles.count}>({items.length})</span>
        <span className={styles.chevron}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className={styles.list}>
          {items.map((t) => (
            <BacklogRow key={t.id} task={t} focusDate={focusDate} />
          ))}
          {items.length === 0 && <div className={styles.empty}>Backlog 是空的</div>}
          <AddBacklogTaskInput />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5：更新 `MonthColumn` 傳 `focusDate`**

`src/features/month/MonthColumn.tsx:67` 改為：

```tsx
      <BacklogSection allTasks={allTasks} focusDate={selectedDate} />
```

- [ ] **Step 6：跑測試確認通過**

Run: `npx vitest run src/features/backlog`
Expected: PASS

- [ ] **Step 7：型別檢查 + commit**

Run: `npm run build`
Expected: 編譯通過

```bash
git add src/features/backlog/ src/features/month/MonthColumn.tsx
git commit -m "feat(backlog): writable BacklogSection with BacklogRow + add input"
```

---

## Task 10：安裝 `@dnd-kit/core` + DnD 基礎建設

**Files:**
- Create: `src/lib/useHoverCapable.ts`, `src/features/plan-view/dnd.ts`, `src/features/plan-view/dragContext.tsx`, `src/features/plan-view/useDroppableZone.ts`
- Modify: `src/features/plan-view/useDraggableRow.ts`（從 stub 換成真版）
- Test: `src/features/plan-view/dnd.test.ts`

- [ ] **Step 1：安裝相依**

Run: `npm install --legacy-peer-deps @dnd-kit/core`
Expected: 安裝成功，`package.json` 出現 `@dnd-kit/core`

- [ ] **Step 2：寫 `dnd.ts` 失敗測試**

`src/features/plan-view/dnd.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { dropId, parseDropId } from "./dnd";

describe("dropId / parseDropId", () => {
  it("round-trips the month target", () => {
    expect(parseDropId(dropId({ kind: "month" }))).toEqual({ kind: "month" });
  });

  it("round-trips a day target with zone", () => {
    const id = dropId({ kind: "day", date: "2026-06-08", zone: "top3" });
    expect(parseDropId(id)).toEqual({ kind: "day", date: "2026-06-08", zone: "top3" });
  });

  it("returns null for an unknown id", () => {
    expect(parseDropId("nonsense")).toBeNull();
  });
});
```

- [ ] **Step 3：跑測試確認失敗**

Run: `npx vitest run src/features/plan-view/dnd.test.ts`
Expected: FAIL

- [ ] **Step 4：實作 `dnd.ts`**

```ts
export type DropTarget =
  | { kind: "month" }
  | { kind: "day"; date: string; zone: "top3" | "other" };

export function dropId(t: DropTarget): string {
  if (t.kind === "month") return "drop:month";
  return `drop:day:${t.date}:${t.zone}`;
}

export function parseDropId(id: string): DropTarget | null {
  if (id === "drop:month") return { kind: "month" };
  const m = /^drop:day:(\d{4}-\d{2}-\d{2}):(top3|other)$/.exec(id);
  if (!m) return null;
  return { kind: "day", date: m[1], zone: m[2] as "top3" | "other" };
}
```

- [ ] **Step 5：實作 `useHoverCapable`**

`src/lib/useHoverCapable.ts`：

```ts
import { useEffect, useState } from "react";

/**
 * True on pointer/hover-capable devices ((hover: hover)). Returns false when
 * matchMedia is unavailable (jsdom/tests) so the no-drag path renders there.
 */
export function useHoverCapable(): boolean {
  const [capable, setCapable] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(hover: hover)");
    setCapable(mq.matches);
    const onChange = () => setCapable(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return capable;
}
```

- [ ] **Step 6：實作 `dragContext.tsx`**

```tsx
import { createContext, useContext } from "react";

const DragEnabledContext = createContext(false);

export const DragEnabledProvider = DragEnabledContext.Provider;

export function useDragEnabled(): boolean {
  return useContext(DragEnabledContext);
}
```

- [ ] **Step 7：實作真版 `useDraggableRow.ts`（取代 Task 8 的 stub）**

```ts
import { useDraggable } from "@dnd-kit/core";
import { useDragEnabled } from "./dragContext";

export function useDraggableRow(id: string) {
  const enabled = useDragEnabled();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled: !enabled });
  return {
    ref: setNodeRef,
    handleProps: enabled ? { ...attributes, ...listeners } : {},
    isDragging,
  };
}
```

- [ ] **Step 8：實作 `useDroppableZone.ts`**

```ts
import { useDroppable } from "@dnd-kit/core";
import { dropId, type DropTarget } from "./dnd";

export function useDroppableZone(target: DropTarget) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId(target) });
  return { ref: setNodeRef, isOver };
}
```

- [ ] **Step 9：跑測試 + 型別**

Run: `npx vitest run src/features/plan-view/dnd.test.ts && npm run build`
Expected: PASS + 編譯通過（`BacklogRow` 現在用真版 `useDraggableRow`，但無 `DndContext` 時 `useDraggable` 仍可 render——dnd-kit 內建 default context；測試環境 `enabled=false`，安全）

- [ ] **Step 10：commit**

```bash
git add package.json package-lock.json src/lib/useHoverCapable.ts src/features/plan-view/dnd.ts src/features/plan-view/dnd.test.ts src/features/plan-view/dragContext.tsx src/features/plan-view/useDraggableRow.ts src/features/plan-view/useDroppableZone.ts
git commit -m "feat(plan): dnd-kit infra — drop ids, drag context, draggable/droppable hooks"
```

---

## Task 11：`PlanLayout` 掛 `DndContext` + `onDragEnd`

> **實作記錄**：`KeyboardSensor` 已在實作中移除。dnd-kit `KeyboardSensor` 在自由形式 drop zone 需要客製 `coordinateGetter`，沒有就會讓列獲得 focus 但操作無效。鍵盤無障礙改由 `⋯` menu 全程鍵盤可操作提供；下方程式碼範例仍保留原稿供參考，實際程式碼只掛 `PointerSensor`。

**Files:**
- Modify: `src/features/plan-view/PlanLayout.tsx`

- [ ] **Step 1：改 `PlanLayout`**

把 `PlanLayout.tsx` 改為（保留既有 CarryoverBanner / tabs / grid，外層包 DnD）：

```tsx
import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Task } from "@/lib/types";
import { CarryoverBanner } from "@/features/carryover/CarryoverBanner";
import { MonthColumn } from "@/features/month/MonthColumn";
import { WeekColumn } from "@/features/week/WeekColumn";
import { DayColumn } from "@/features/day/DayColumn";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { MOCK_CARRYOVER_MONTH } from "@/mock/data";
import { useTasksStore } from "@/store/tasks";
import { nextFreeDailySlot } from "@/lib/tasks";
import { useHoverCapable } from "@/lib/useHoverCapable";
import { DragEnabledProvider } from "./dragContext";
import { parseDropId } from "./dnd";
import styles from "./PlanLayout.module.css";

export interface PlanLayoutProps {
  allTasks: Task[];
  selectedDate: string;
  month: string;
}

type MobileTab = "month" | "week" | "day";

export function PlanLayout({ allTasks, selectedDate, month }: PlanLayoutProps) {
  const [tab, setTab] = useState<MobileTab>("month");
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragEnabled = useHoverCapable();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const activeTask = activeId ? allTasks.find((t) => t.id === activeId) : null;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const target = parseDropId(String(e.over.id));
    if (!target) return;
    const id = String(e.active.id);
    const store = useTasksStore.getState();
    if (target.kind === "month") {
      void store.promoteToMonth(id, month);
      return;
    }
    void store.planScheduleDay(id, target.date).then(() => {
      const s = useTasksStore.getState();
      if (target.zone === "top3") {
        s.setDailyPriority(id, nextFreeDailySlot(s.tasks, target.date), target.date);
      } else {
        s.setDailyPriority(id, null, target.date);
      }
    });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <DragEnabledProvider value={dragEnabled}>
        <main className={styles.page}>
          <CarryoverBanner
            fromLabel="從上月延續"
            summary={`${MOCK_CARRYOVER_MONTH.fromMonth} 沒做完的任務`}
            count={MOCK_CARRYOVER_MONTH.count}
            actions={["→ 本月三件事", "→ 本月其他", "丟回 backlog"]}
          />

          <div className={styles.mobileTabs}>
            <SegmentedControl<MobileTab>
              value={tab}
              onValueChange={setTab}
              size="sm"
              options={[
                { value: "month", label: "Month" },
                { value: "week", label: "Week" },
                { value: "day", label: "Day" },
              ]}
            />
          </div>

          <div className={styles.grid}>
            <div className={[styles.cell, tab !== "month" && styles.mobileHidden].filter(Boolean).join(" ")}>
              <MonthColumn allTasks={allTasks} month={month} selectedDate={selectedDate} />
            </div>
            <div className={[styles.cell, tab !== "week" && styles.mobileHidden].filter(Boolean).join(" ")}>
              <WeekColumn allTasks={allTasks} selectedDate={selectedDate} />
            </div>
            <div className={[styles.cell, tab !== "day" && styles.mobileHidden].filter(Boolean).join(" ")}>
              <DayColumn allTasks={allTasks} selectedDate={selectedDate} variant="plan-narrow" interactive />
            </div>
          </div>
        </main>
        <DragOverlay>
          {activeTask ? <div className={styles.dragGhost}>{activeTask.title}</div> : null}
        </DragOverlay>
      </DragEnabledProvider>
    </DndContext>
  );
}
```

- [ ] **Step 2：加 `dragGhost` 樣式**

在 `src/features/plan-view/PlanLayout.module.css` 末尾加：

```css
.dragGhost {
  padding: var(--space-1) var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-1);
  font-size: var(--font-size-base);
}
```

> 若這些 token 名與專案不同，照既有 `.module.css` 內用到的變數調整。

- [ ] **Step 3：型別 + 既有測試**

Run: `npm run build && npx vitest run`
Expected: 編譯通過、既有測試全綠（PlanLayout render 路徑 `dragEnabled=false`，行為不變）

- [ ] **Step 4：commit**

```bash
git add src/features/plan-view/PlanLayout.tsx src/features/plan-view/PlanLayout.module.css
git commit -m "feat(plan): DndContext + onDragEnd routing drops to store ops"
```

---

## Task 12：掛 droppable 區塊（Month 區 / Day 子區 / Week 日格子區）

**Files:**
- Modify: `src/features/month/MonthColumn.tsx`, `src/features/day/DayColumn.tsx`, `src/features/week/WeekColumn.tsx`
- 相關 `.module.css` 加 `.isOver` 高亮

- [ ] **Step 1：Month 區 droppable**

在 `MonthColumn.tsx`：import `useDroppableZone`，在最外層 `<div className={styles.col}>` 內包一層 droppable，或直接把 ref 掛在 `styles.col`。最小做法——在 `MonthColumn` 內容外層加：

```tsx
import { useDroppableZone } from "@/features/plan-view/useDroppableZone";
// ...
export function MonthColumn({ allTasks, month, selectedDate }: MonthColumnProps) {
  const drop = useDroppableZone({ kind: "month" });
  // ...existing useMemo / derivations...
  return (
    <div
      ref={drop.ref}
      className={[styles.col, drop.isOver && styles.isOver].filter(Boolean).join(" ")}
    >
      {/* ...existing header / BacklogSection / sections / AddMonthTaskInput... */}
    </div>
  );
}
```

在 `MonthColumn.module.css` 加：`.isOver { outline: 2px dashed var(--color-accent); outline-offset: -4px; }`

- [ ] **Step 2：Day 欄兩個子區 droppable**

在 `DayColumn.tsx`：import `useDroppableZone`，建兩個 zone，並用兩個包裹容器界定「三件事區」與「其他區」的落點。最小做法——把 Top3Card 區塊包進 top3 droppable、其餘 primary sections 包進 other droppable：

```tsx
import { useDroppableZone } from "@/features/plan-view/useDroppableZone";
// 在元件內：
const top3Drop = useDroppableZone({ kind: "day", date: selectedDate, zone: "top3" });
const otherDrop = useDroppableZone({ kind: "day", date: selectedDate, zone: "other" });
```

把現有 Top3Card 包成：

```tsx
<div ref={top3Drop.ref} className={[styles.dropZone, top3Drop.isOver && styles.isOver].filter(Boolean).join(" ")}>
  {top3.length > 0 ? (
    <Top3Card tasks={top3} title={isToday ? "今天最重要的三件事" : "最重要的三件事"} variant="accent" date={selectedDate} interactive={isInteractive} />
  ) : (
    isInteractive && <div className={styles.dropHint}>拖到這裡 → 今天三件事</div>
  )}
</div>
```

把 `otherPlanned` + `adhoc` 兩個 section 一起包進：

```tsx
<div ref={otherDrop.ref} className={[styles.dropZone, otherDrop.isOver && styles.isOver].filter(Boolean).join(" ")}>
  {/* otherPlanned section */}
  {/* adhoc section */}
  {isInteractive && otherPlanned.length === 0 && adhoc.length === 0 && (
    <div className={styles.dropHint}>拖到這裡 → 其他計劃內</div>
  )}
</div>
```

> `dropHint` 只在 `isInteractive`（含桌機/手機）顯示即可；空區也要能接 drop，所以給最小高度。trails section 與 AddTaskInput 維持在 otherDrop 之外或之內皆可（建議放 otherDrop 之外避免拖到軌跡區）。

在 `DayColumn.module.css` 加：

```css
.dropZone { min-height: var(--space-6); border-radius: var(--radius-sm); }
.dropZone.isOver { outline: 2px dashed var(--color-accent); outline-offset: -4px; background: var(--color-accent-soft, transparent); }
.dropHint { color: var(--color-text-muted); font-size: var(--font-size-sm); padding: var(--space-2); text-align: center; }
```

- [ ] **Step 3：Week 每個日格兩個子區 droppable**

`WeekColumn.tsx` 的日格 `<Link>` 內含 top-3 `<ol>` 與 more/empty。改成每個日格暴露兩個 droppable 子區。因 `<Link>` 是整塊導覽，droppable ref 要掛在 Link 內的子容器。把 `<ol className={styles.tasks}>` 拆成 top3 子區與 other 子區：

```tsx
import { useDroppableZone } from "@/features/plan-view/useDroppableZone";

function WeekDayCell({ date, allTasks, selectedDate }: { date: string; allTasks: Task[]; selectedDate: string }) {
  const top3Drop = useDroppableZone({ kind: "day", date, zone: "top3" });
  const otherDrop = useDroppableZone({ kind: "day", date, zone: "other" });
  const entries = tasksOnDate(allTasks, date);
  const primary = entries.filter((e) => e.kind === "primary");
  const top3 = primary
    .filter((e) => e.task.custom_fields.daily_priority)
    .sort((a, b) => Number(a.task.custom_fields.daily_priority) - Number(b.task.custom_fields.daily_priority))
    .slice(0, 3);
  const otherCount = primary.length - top3.length;
  const isSelected = date === selectedDate;
  return (
    <li className={styles.dayItem}>
      <Link
        to="/plan/$date"
        params={{ date }}
        className={[styles.day, isSelected && styles.selected].filter(Boolean).join(" ")}
        aria-label={`切到 ${date}`}
        aria-current={isSelected ? "date" : undefined}
      >
        <div className={styles.dayBox}>
          <div className={styles.dayNum}>{dayOfMonth(date)}</div>
          <div className={styles.dayWk}>{shortWeekday(date).toUpperCase()}</div>
        </div>
        <div className={styles.cellBody}>
          <ol
            ref={top3Drop.ref}
            className={[styles.tasks, styles.zone, top3Drop.isOver && styles.isOver].filter(Boolean).join(" ")}
          >
            {top3.map((e, i) => (
              <li
                key={e.task.id}
                className={[styles.task, e.task.status === "done" && styles.done].filter(Boolean).join(" ")}
              >
                <span className={styles.taskOrder}>{i + 1}.</span> {e.task.title}
              </li>
            ))}
            {top3.length === 0 && <li className={styles.zoneHint}>三件事</li>}
          </ol>
          <div
            ref={otherDrop.ref}
            className={[styles.otherZone, styles.zone, otherDrop.isOver && styles.isOver].filter(Boolean).join(" ")}
          >
            {otherCount > 0 ? (
              <span className={styles.more}>還有 {otherCount} 件其他任務</span>
            ) : (
              <span className={styles.zoneHint}>其他</span>
            )}
          </div>
          {primary.length === 0 && top3.length === 0 && otherCount === 0 && (
            <div className={styles.empty}>—</div>
          )}
        </div>
      </Link>
    </li>
  );
}
```

並把 `WeekColumn` 的 `week.map(...)` body 換成 `<WeekDayCell key={date} date={date} allTasks={allTasks} selectedDate={selectedDate} />`，把原本 inline 的計算移進 `WeekDayCell`。`Task` 型別 import 已存在。

在 `WeekColumn.module.css` 加：

```css
.zone { border-radius: var(--radius-sm); }
.zone.isOver { outline: 2px dashed var(--color-accent); outline-offset: -2px; }
.otherZone { min-height: var(--space-5); }
.zoneHint { color: var(--color-text-muted); font-size: var(--font-size-xs); }
```

> droppable 掛在 `<Link>` 內的子容器，drop 命中不會觸發導覽（drop 是放開、click 是點擊；dnd-kit PointerSensor distance 8 已隔開）。

- [ ] **Step 4：型別 + 既有測試 + week 測試**

Run: `npm run build && npx vitest run src/features/week`
Expected: 編譯通過；既有 `WeekColumn.test.tsx` 仍綠（若測試斷言文字「還有 n 件其他任務」「—」「切到 <date>」仍在，應不需改；若因結構變動 fail，更新斷言定位）

- [ ] **Step 5：commit**

```bash
git add src/features/month/MonthColumn.tsx src/features/month/MonthColumn.module.css src/features/day/DayColumn.tsx src/features/day/DayColumn.module.css src/features/week/WeekColumn.tsx src/features/week/WeekColumn.module.css
git commit -m "feat(plan): droppable zones — month area, day top3/other, week cell sub-zones"
```

---

## Task 13：掛 draggable 來源（Month / Day 列）

**Files:**
- Modify: `src/features/month/MonthRow.tsx`, `src/features/month/MonthHeroCard.tsx`, `src/features/day/TaskRow.tsx`, `src/features/day/Top3Card.tsx`
- 同時把 `useMonthRow` 的 promote 改用 `planScheduleDay`

- [ ] **Step 1：`useMonthRow` promote 改用 `planScheduleDay`**

`src/features/month/useMonthRow.ts`：把

```ts
  const promoteToDay = useTasksStore((s) => s.promoteToDay);
```

改成

```ts
  const planScheduleDay = useTasksStore((s) => s.planScheduleDay);
```

並把 `promote` 內的 `promoteToDay(id, opts.selectedDate);` 改成 `planScheduleDay(id, opts.selectedDate);`。

> 對月來源（無 primaryDate）`planScheduleDay` = append，行為與原 `promoteToDay` 等價、額外補本月（月來源本月已是 active，no-op）。既有 `MonthRow.test.tsx` 應仍綠。

- [ ] **Step 2：MonthRow 掛 draggable**

`src/features/month/MonthRow.tsx`：import `useDraggableRow`，在最外層 row div 掛 ref + handleProps（僅 `kind === "primary"` 時可拖，軌跡列不可拖）：

```tsx
import { useDraggableRow } from "@/features/plan-view/useDraggableRow";
// 元件內：
const drag = useDraggableRow(task.id);
const draggable = kind === "primary";
// 最外層 div：
<div
  ref={draggable ? drag.ref : undefined}
  className={[styles.row, isDone && styles.done, drag.isDragging && styles.dragging].filter(Boolean).join(" ")}
  {...(draggable ? drag.handleProps : {})}
>
```

`MonthRow.module.css` 加 `.dragging { opacity: 0.5; }`。

- [ ] **Step 3：MonthHeroCard 列掛 draggable**

`src/features/month/MonthHeroCard.tsx`：同樣對每個 hero task 列掛 `useDraggableRow(task.id)` 的 ref + handleProps。因 hero 是 map 出多列，抽一個內部子元件 `HeroRow` 呼叫 hook（hook 不可在 map callback 直接呼叫）：

```tsx
import { useDraggableRow } from "@/features/plan-view/useDraggableRow";

function HeroRow({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const drag = useDraggableRow(id);
  return (
    <div ref={drag.ref} className={[className, drag.isDragging && /* dragging class */ ""].filter(Boolean).join(" ")} {...drag.handleProps}>
      {children}
    </div>
  );
}
```

把 hero 內每個 task 列的外層容器換成 `<HeroRow id={task.id} className={...}>...</HeroRow>`。實作時對照 `MonthHeroCard.tsx` 既有 JSX 結構，把列容器替換即可。

- [ ] **Step 4：Day TaskRow 掛 draggable**

`src/features/day/TaskRow.tsx`：import `useDraggableRow`，最外層 row div 掛 ref + handleProps，僅 `kind === "primary"` 可拖：

```tsx
import { useDraggableRow } from "@/features/plan-view/useDraggableRow";
// 元件內：
const drag = useDraggableRow(task.id);
const draggable = kind === "primary";
// 最外層 div（保留既有 className 組合，加 dragging）：
<div
  ref={draggable ? drag.ref : undefined}
  className={[styles.row, styles[`k_${kind}`], isDone && styles.done, drag.isDragging && styles.dragging].filter(Boolean).join(" ")}
  {...(draggable ? drag.handleProps : {})}
>
```

`TaskRow.module.css` 加 `.dragging { opacity: 0.5; }`。

- [ ] **Step 5：Top3Card 列掛 draggable**

`src/features/day/Top3Card.tsx`：對每個 top3 task 列抽 `HeroRow`-style 子元件呼叫 `useDraggableRow(task.id)`，掛 ref + handleProps（對照既有 JSX，把列容器替換）。

- [ ] **Step 6：型別 + 既有測試**

Run: `npm run build && npx vitest run`
Expected: 編譯通過、全綠（`dragEnabled=false` 時 handleProps 為空、ref 仍掛但無 listeners，行為不變）

- [ ] **Step 7：commit**

```bash
git add src/features/month/useMonthRow.ts src/features/month/MonthRow.tsx src/features/month/MonthRow.module.css src/features/month/MonthHeroCard.tsx src/features/day/TaskRow.tsx src/features/day/TaskRow.module.css src/features/day/Top3Card.tsx
git commit -m "feat(plan): make month/day task rows draggable; menu promote uses planScheduleDay"
```

---

## Task 14：e2e（Playwright）

**Files:**
- Modify: `e2e/plan-interaction.spec.ts`

> e2e 跑真實 BFF + mock WSPC。dnd-kit 的 PointerSensor 需要實際 pointer 移動，用 `mouse.move` 分段模擬（`dragTo` 對 dnd-kit 常失效）。

- [ ] **Step 1：加 backlog menu promote 測試**

在 `e2e/plan-interaction.spec.ts` 末尾加（先展開 Backlog 區）：

```ts
test("adds a backlog task and promotes it to the focus day via menu", async ({ page }) => {
  await page.goto("/plan/2026-06-10");
  // 展開 Backlog
  await page.getByRole("button", { name: /Backlog/ }).click();
  // 新增一筆 backlog
  const input = page.getByPlaceholder("+ 加一件想做但還沒排的事…");
  await input.fill("backlog 測試任務");
  await input.press("Enter");
  await expect(page.getByText("backlog 測試任務")).toBeVisible();

  // 用該列的 menu promote 到焦點日 ①
  const row = page
    .locator("div")
    .filter({ has: page.getByText("backlog 測試任務") })
    .filter({ has: page.getByRole("button", { name: "更多動作" }) })
    .last();
  await row.getByRole("button", { name: "更多動作" }).click();
  await page.getByRole("menuitem", { name: /· ① 三件事/ }).click();

  const top3Card = page
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: /最重要的三件事/ }) })
    .last();
  await expect(top3Card.getByText("backlog 測試任務")).toBeVisible();
});
```

- [ ] **Step 2：跑這條 e2e 確認綠**

Run: `npm run test:e2e -- -g "promotes it to the focus day via menu"`
Expected: PASS

- [ ] **Step 3：加桌機拖曳測試（backlog → Day 三件事區）**

```ts
test("drags a backlog task onto the focus day's top-3 zone", async ({ page }) => {
  await page.goto("/plan/2026-06-10");
  await page.getByRole("button", { name: /Backlog/ }).click();
  const input = page.getByPlaceholder("+ 加一件想做但還沒排的事…");
  await input.fill("拖曳測試任務");
  await input.press("Enter");
  const source = page.getByText("拖曳測試任務");
  await expect(source).toBeVisible();

  // 目標：Day 欄三件事 drop 區（空時顯示提示文字）
  const target = page.getByText("拖到這裡 → 今天三件事");

  const sBox = await source.boundingBox();
  const tBox = await target.boundingBox();
  if (!sBox || !tBox) throw new Error("missing bounding box");

  await page.mouse.move(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);
  await page.mouse.down();
  // 分段移動觸發 dnd-kit PointerSensor（distance 8）
  await page.mouse.move(sBox.x + sBox.width / 2 + 20, sBox.y + sBox.height / 2 + 20, { steps: 5 });
  await page.mouse.move(tBox.x + tBox.width / 2, tBox.y + tBox.height / 2, { steps: 10 });
  await page.mouse.up();

  const top3Card = page
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: /最重要的三件事/ }) })
    .last();
  await expect(top3Card.getByText("拖曳測試任務")).toBeVisible();
});
```

> 若桌機 viewport 下三欄並排，三件事提示文字定位穩定。playwright.config 預設 viewport 為桌機寬度（確認 `(hover: hover)` 在 headless Chromium 為 true，使 `dragEnabled` 啟用；Chromium headless 預設 hover 能力為 true）。

- [ ] **Step 4：跑全部 e2e**

Run: `npm run test:e2e`
Expected: 全 PASS（含既有測試）

> 若拖曳測試在 CI/headless 不穩，將其標 `test.describe.configure({ retries: 1 })` 或改用更小步距；但先以本機綠為準。

- [ ] **Step 5：commit**

```bash
git add e2e/plan-interaction.spec.ts
git commit -m "test(e2e): backlog promote via menu + drag onto day top-3 zone"
```

---

## Task 15：手動驗收 + ROADMAP 更新

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 1：全套自動化驗證**

Run: `npm run build && npx vitest run && npm run test:e2e`
Expected: 三者全綠

- [ ] **Step 2：手動 preview 驗收（preview + AI agent）**

由 AI agent `preview_start` 開預覽，先探登入狀態：已登入直接驗；未登入請使用者協助 WSPC device flow。逐項對照設計文件「驗收標準」1–11：

- backlog 新增 / 完成 / 編輯 / 刪除
- 拖 backlog → Month 區 / Day 三件事區 / Day 其他區 / Week 日格（兩子區）
- 已排某天 task 拖到別天 → 乾淨重排、舊那天無順延軌跡；有更早真實軌跡則保留
- 拖到某日自動補本月、同時顯示在 Month 欄
- drop 高亮、樂觀更新、失敗 toast
- 窄視窗（手機）：backlog/月列只出 menu、不可拖
- ~~鍵盤拖曳（dnd-kit KeyboardSensor）~~ → **已改由 `⋯` menu 提供鍵盤無障礙**（KeyboardSensor 移除，理由見 Task 11 記錄）

- [ ] **Step 3：更新 ROADMAP**

把 `ROADMAP.md` 進度表 Slice 4 標 ✅，並把 Slice 4 段落內容更新為實際完成形（記錄範圍擴大為「Plan 模式完整拖曳」、Plan/Focus 語意分流、day→月降級延後 Slice 6 的決策）。連結設計與計畫文件。

- [ ] **Step 4：commit**

```bash
git add ROADMAP.md
git commit -m "docs(roadmap): mark Slice 4 complete (Plan-mode full drag + backlog)"
```

---

## 自我檢查（寫計畫後）

- **Spec 覆蓋**：Backlog 寫入（Task 3/5/6/8/9）、`promoteToMonth`（Task 4/6）、`planScheduleDay` 替換語意 + 補本月（Task 5/6）、`nextFreeDailySlot`（Task 2）、拖曳基礎建設（Task 10/11）、droppable 三類含 Week 子區（Task 12）、draggable 來源（Task 13）、menu promote（Task 8 + 既有 MonthRow）、裝置分流（Task 10 `useHoverCapable` + `dragContext`）、e2e（Task 14）、手動 + ROADMAP（Task 15）。`is_adhoc` 預設由 `addBacklogTask`（Task 3）寫死 false、promote 不動。✅ 全覆蓋。
- **型別一致**：`planScheduleDay(tasks,id,date)`、`promoteToMonth(tasks,id,month)`、`nextFreeDailySlot(all,date):Priority`、`dropId/parseDropId`、`useDraggableRow(id)→{ref,handleProps,isDragging}`、`useDroppableZone(target)→{ref,isOver}`、`DropTarget` union 全程一致。
- **Placeholder**：無 TBD；DnD 元件改動以精確程式碼或精確替換指示呈現。
- **風險點**：Task 8 先用 `useDraggableRow` stub、Task 10 換真版——順序正確（Task 8 commit 後仍可編譯，stub 回 no-op）。Week 既有測試斷言若因結構變動需微調（Task 12 Step 4 已標示）。
