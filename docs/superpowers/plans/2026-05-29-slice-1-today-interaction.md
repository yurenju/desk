# Slice 1 — Today 互動 + localStorage 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目標:** 讓 Today mode 的 task 可互動(完成 / 新增 / 編輯 / 刪除 / `daily_priority` 切換),寫入 Zustand store 並持久化到 localStorage,刷新後資料還在;Plan mode 改讀同一個 store 但維持唯讀。

**架構:** 互動的核心邏輯抽成 `src/store/taskOps.ts` 的純函式(immutable、可注入 `now` / `id`,好測),Zustand store(`src/store/tasks.ts`)只是呼叫純函式 + `persist` 的薄殼。Component 以 selector 直讀 store;`TaskRow` 與 `Top3Card` 透過共用的 `useTaskRow` hook 取得一致的互動行為,只在 `interactive` 為真(Today mode)時開放,Plan mode 維持唯讀。

**技術棧:** React 19、Zustand(+ `zustand/middleware/persist`)、Base UI、CSS Modules、Vitest + Testing Library、Playwright(e2e)。

**對應 spec:** [docs/superpowers/specs/2026-05-29-slice-1-today-interaction-design.md](../specs/2026-05-29-slice-1-today-interaction-design.md)

---

## 檔案結構

**新增:**

- `src/store/taskOps.ts` — 互動的純函式(`toggleDone` / `addTodayTask` / `editTitle` / `deleteTask` / `restoreTask` / `setDailyPriority`),全部回傳新陣列
- `src/store/taskOps.test.ts` — 純函式單元測試(主力測試)
- `src/store/tasks.ts` — Zustand store(state + actions + `persist`),薄殼呼叫純函式
- `src/store/tasks.test.ts` — store 層測試(seed / persist / recentlyDeleted)
- `src/ui/PriorityRing/PriorityRing.tsx` + `PriorityRing.module.css` + `index.ts` — 優先序 ring(實心數字 / 虛線空)
- `src/features/day/useTaskRow.ts` — 共用單列互動 hook(inline 編輯 local state + 包裝 store actions)
- `src/features/day/AddTaskInput.tsx` + `AddTaskInput.module.css` — 常駐新增輸入列
- `src/features/day/DeleteUndoToast.tsx` + `DeleteUndoToast.module.css` — 刪除後的復原 toast
- `playwright.config.ts` — Playwright 設定
- `e2e/today-interaction.spec.ts` — Today 互動 e2e(資料來源無關設計)

**修改:**

- `src/features/day/TaskRow.tsx` — 解除 disabled、加 hover ✎/🗑、加 ring,接 `useTaskRow`
- `src/features/day/Top3Card.tsx` — 改為可互動,與 `TaskRow` 共用 `useTaskRow`
- `src/features/day/DayColumn.tsx` — 從 store 讀、依 variant 決定 `interactive`、組裝 `AddTaskInput`
- `src/features/plan-view/TodayLayout.tsx` — 從 store 讀 `today`、掛 `DeleteUndoToast`
- `src/features/plan-view/PlanLayout.tsx` — 從 store 讀(維持唯讀)
- `src/pages/TodayPage.tsx` / `src/pages/PlanPage.tsx` — 移除 mock import,改讀 store
- `package.json` — 加 `zustand` 依賴、`test:e2e` script
- `src/features/day/TaskRow.module.css` / `Top3Card.module.css` — hover 控制 + mobile fallback

---

## Task 1: 安裝 zustand 依賴

**檔案:**

- 修改:`package.json`

- [ ] **步驟 1:安裝 zustand**

Run: `npm install zustand`
Expected: `package.json` 的 `dependencies` 出現 `"zustand"`,`npm install` 成功無錯。

- [ ] **步驟 2:確認既有測試仍通過**

Run: `npm test -- --run`
Expected: 既有 21 個測試(tasks 17 + theme 4)全 PASS。

- [ ] **步驟 3:Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(slice-1): 安裝 zustand"
```

---

## Task 2: taskOps — toggleDone

**檔案:**

- 新增:`src/store/taskOps.ts`
- 測試:`src/store/taskOps.test.ts`

- [ ] **步驟 1:寫失敗的測試**

```typescript
// src/store/taskOps.test.ts
import { describe, it, expect } from "vitest";
import type { Task } from "@/lib/types";
import { toggleDone } from "./taskOps";

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: `task-${overrides.id}`,
    status: "open",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    custom_fields: {},
    ...overrides,
  };
}

const NOW = "2026-05-22T09:00:00.000Z";

describe("toggleDone", () => {
  it("marks an open task as done and writes done_on", () => {
    const tasks = [makeTask({ id: "a" })];
    const next = toggleDone(tasks, "a", NOW);
    expect(next[0].status).toBe("done");
    expect(next[0].custom_fields.done_on).toBe(NOW);
  });

  it("reopens a done task and clears done_on", () => {
    const tasks = [
      makeTask({ id: "a", status: "done", custom_fields: { done_on: NOW } }),
    ];
    const next = toggleDone(tasks, "a", NOW);
    expect(next[0].status).toBe("open");
    expect(next[0].custom_fields.done_on).toBeUndefined();
  });

  it("does not mutate the input array", () => {
    const tasks = [makeTask({ id: "a" })];
    toggleDone(tasks, "a", NOW);
    expect(tasks[0].status).toBe("open");
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npm test -- --run src/store/taskOps.test.ts`
Expected: FAIL,訊息類似 `Failed to resolve import "./taskOps"`。

- [ ] **步驟 3:寫最小實作**

```typescript
// src/store/taskOps.ts
import type { Task, TaskCustomFields } from "@/lib/types";

function patch(t: Task, cf: Partial<TaskCustomFields>, now?: string): Task {
  return {
    ...t,
    ...(now ? { updated_at: now } : {}),
    custom_fields: { ...t.custom_fields, ...cf },
  };
}

export function toggleDone(tasks: Task[], id: string, now: string): Task[] {
  return tasks.map((t) => {
    if (t.id !== id) return t;
    const isDone = t.status === "done";
    return {
      ...patch(t, { done_on: isDone ? undefined : now }, now),
      status: isDone ? "open" : "done",
    };
  });
}
```

- [ ] **步驟 4:跑測試確認通過**

Run: `npm test -- --run src/store/taskOps.test.ts`
Expected: PASS(3 個測試)。

- [ ] **步驟 5:Commit**

```bash
git add src/store/taskOps.ts src/store/taskOps.test.ts
git commit -m "feat(slice-1): taskOps.toggleDone 純函式"
```

---

## Task 3: taskOps — addTodayTask

**檔案:**

- 修改:`src/store/taskOps.ts`、`src/store/taskOps.test.ts`

- [ ] **步驟 1:寫失敗的測試(加在既有檔案末尾)**

```typescript
import { addTodayTask } from "./taskOps";

describe("addTodayTask", () => {
  it("appends an adhoc task scheduled for today", () => {
    const next = addTodayTask([], "回電話", "2026-05-22", "new-id", NOW);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      id: "new-id",
      title: "回電話",
      status: "open",
      created_at: NOW,
      custom_fields: { scheduled_dates: ["2026-05-22"], is_adhoc: "true" },
    });
  });

  it("trims the title", () => {
    const next = addTodayTask([], "  買菜  ", "2026-05-22", "x", NOW);
    expect(next[0].title).toBe("買菜");
  });

  it("ignores a blank title", () => {
    const next = addTodayTask([], "   ", "2026-05-22", "x", NOW);
    expect(next).toHaveLength(0);
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npm test -- --run src/store/taskOps.test.ts`
Expected: FAIL,`addTodayTask is not a function` / import 失敗。

- [ ] **步驟 3:寫最小實作(加在 `taskOps.ts`)**

```typescript
export function addTodayTask(
  tasks: Task[],
  title: string,
  today: string,
  id: string,
  now: string,
): Task[] {
  const trimmed = title.trim();
  if (!trimmed) return tasks;
  const task: Task = {
    id,
    title: trimmed,
    status: "open",
    parent_id: null,
    created_at: now,
    updated_at: now,
    custom_fields: { scheduled_dates: [today], is_adhoc: "true" },
  };
  return [...tasks, task];
}
```

- [ ] **步驟 4:跑測試確認通過**

Run: `npm test -- --run src/store/taskOps.test.ts`
Expected: PASS(6 個測試)。

- [ ] **步驟 5:Commit**

```bash
git add src/store/taskOps.ts src/store/taskOps.test.ts
git commit -m "feat(slice-1): taskOps.addTodayTask 純函式"
```

---

## Task 4: taskOps — editTitle(空白取消)

**檔案:**

- 修改:`src/store/taskOps.ts`、`src/store/taskOps.test.ts`

- [ ] **步驟 1:寫失敗的測試**

```typescript
import { editTitle } from "./taskOps";

describe("editTitle", () => {
  it("updates the title and updated_at", () => {
    const tasks = [makeTask({ id: "a", title: "舊" })];
    const next = editTitle(tasks, "a", "新標題", NOW);
    expect(next[0].title).toBe("新標題");
    expect(next[0].updated_at).toBe(NOW);
  });

  it("trims the new title", () => {
    const tasks = [makeTask({ id: "a" })];
    const next = editTitle(tasks, "a", "  乾淨  ", NOW);
    expect(next[0].title).toBe("乾淨");
  });

  it("leaves the task unchanged when the new title is blank", () => {
    const tasks = [makeTask({ id: "a", title: "保留" })];
    const next = editTitle(tasks, "a", "   ", NOW);
    expect(next[0].title).toBe("保留");
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npm test -- --run src/store/taskOps.test.ts`
Expected: FAIL,import 失敗。

- [ ] **步驟 3:寫最小實作**

```typescript
export function editTitle(tasks: Task[], id: string, title: string, now: string): Task[] {
  const trimmed = title.trim();
  if (!trimmed) return tasks;
  return tasks.map((t) => (t.id === id ? { ...t, title: trimmed, updated_at: now } : t));
}
```

- [ ] **步驟 4:跑測試確認通過**

Run: `npm test -- --run src/store/taskOps.test.ts`
Expected: PASS(9 個測試)。

- [ ] **步驟 5:Commit**

```bash
git add src/store/taskOps.ts src/store/taskOps.test.ts
git commit -m "feat(slice-1): taskOps.editTitle 純函式（空白取消）"
```

---

## Task 5: taskOps — deleteTask + restoreTask

**檔案:**

- 修改:`src/store/taskOps.ts`、`src/store/taskOps.test.ts`

- [ ] **步驟 1:寫失敗的測試**

```typescript
import { deleteTask, restoreTask } from "./taskOps";

describe("deleteTask / restoreTask", () => {
  it("removes the task and reports its original index", () => {
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" }), makeTask({ id: "c" })];
    const { tasks: next, removed } = deleteTask(tasks, "b");
    expect(next.map((t) => t.id)).toEqual(["a", "c"]);
    expect(removed).toEqual({ task: tasks[1], index: 1 });
  });

  it("returns removed=null when id not found", () => {
    const tasks = [makeTask({ id: "a" })];
    const { tasks: next, removed } = deleteTask(tasks, "zzz");
    expect(next).toHaveLength(1);
    expect(removed).toBeNull();
  });

  it("restoreTask puts the task back at its original index", () => {
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "c" })];
    const removed = { task: makeTask({ id: "b" }), index: 1 };
    const next = restoreTask(tasks, removed);
    expect(next.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npm test -- --run src/store/taskOps.test.ts`
Expected: FAIL,import 失敗。

- [ ] **步驟 3:寫最小實作**

```typescript
export interface RemovedTask {
  task: Task;
  index: number;
}

export function deleteTask(
  tasks: Task[],
  id: string,
): { tasks: Task[]; removed: RemovedTask | null } {
  const index = tasks.findIndex((t) => t.id === id);
  if (index < 0) return { tasks, removed: null };
  const removed: RemovedTask = { task: tasks[index], index };
  return { tasks: tasks.filter((t) => t.id !== id), removed };
}

export function restoreTask(tasks: Task[], removed: RemovedTask): Task[] {
  const next = [...tasks];
  next.splice(removed.index, 0, removed.task);
  return next;
}
```

- [ ] **步驟 4:跑測試確認通過**

Run: `npm test -- --run src/store/taskOps.test.ts`
Expected: PASS(12 個測試)。

- [ ] **步驟 5:Commit**

```bash
git add src/store/taskOps.ts src/store/taskOps.test.ts
git commit -m "feat(slice-1): taskOps.deleteTask / restoreTask 純函式"
```

---

## Task 6: taskOps — setDailyPriority（自動騰位）

**檔案:**

- 修改:`src/store/taskOps.ts`、`src/store/taskOps.test.ts`

- [ ] **步驟 1:寫失敗的測試**

```typescript
import { setDailyPriority } from "./taskOps";

describe("setDailyPriority", () => {
  const today = "2026-05-22";
  const onToday = (id: string, p?: "1" | "2" | "3") =>
    makeTask({
      id,
      custom_fields: { scheduled_dates: [today], ...(p ? { daily_priority: p } : {}) },
    });

  it("assigns a priority to a task that had none", () => {
    const tasks = [onToday("a")];
    const next = setDailyPriority(tasks, "a", "1", today);
    expect(next[0].custom_fields.daily_priority).toBe("1");
  });

  it("evicts the task that already held that priority today", () => {
    const tasks = [onToday("a", "1"), onToday("b")];
    const next = setDailyPriority(tasks, "b", "1", today);
    expect(next.find((t) => t.id === "b")!.custom_fields.daily_priority).toBe("1");
    expect(next.find((t) => t.id === "a")!.custom_fields.daily_priority).toBeUndefined();
  });

  it("does not evict a same-priority task scheduled on a different day", () => {
    const other = makeTask({
      id: "x",
      custom_fields: { scheduled_dates: ["2026-05-24"], daily_priority: "1" },
    });
    const tasks = [other, onToday("b")];
    const next = setDailyPriority(tasks, "b", "1", today);
    expect(next.find((t) => t.id === "x")!.custom_fields.daily_priority).toBe("1");
  });

  it("removes the priority when n is null", () => {
    const tasks = [onToday("a", "2")];
    const next = setDailyPriority(tasks, "a", null, today);
    expect(next[0].custom_fields.daily_priority).toBeUndefined();
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npm test -- --run src/store/taskOps.test.ts`
Expected: FAIL,import 失敗。

- [ ] **步驟 3:寫最小實作**

```typescript
import { primaryDate } from "@/lib/tasks";
import type { Priority } from "@/lib/types";

export function setDailyPriority(
  tasks: Task[],
  id: string,
  n: Priority | null,
  today: string,
): Task[] {
  return tasks.map((t) => {
    if (t.id === id) return patch(t, { daily_priority: n ?? undefined });
    // 騰位:只在今天 primary 的 task 之間清掉撞號者
    if (n !== null && primaryDate(t) === today && t.custom_fields.daily_priority === n) {
      return patch(t, { daily_priority: undefined });
    }
    return t;
  });
}
```

> 在 `taskOps.ts` 頂部已 import `Priority` 與 `primaryDate`(若步驟 3 是新增 import,放到檔案最上方既有 import 區)。

- [ ] **步驟 4:跑測試確認通過**

Run: `npm test -- --run src/store/taskOps.test.ts`
Expected: PASS(16 個測試)。

- [ ] **步驟 5:Commit**

```bash
git add src/store/taskOps.ts src/store/taskOps.test.ts
git commit -m "feat(slice-1): taskOps.setDailyPriority 自動騰位"
```

---

## Task 7: Zustand store（persist + seed + today）

**檔案:**

- 新增:`src/store/tasks.ts`、`src/store/tasks.test.ts`

- [ ] **步驟 1:寫失敗的測試**

```typescript
// src/store/tasks.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useTasksStore } from "./tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";

beforeEach(() => {
  localStorage.clear();
  // 重置成 seed 狀態(persist 不會自動重跑)
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, recentlyDeleted: null });
});

describe("useTasksStore", () => {
  it("seeds today from MOCK_TODAY", () => {
    expect(useTasksStore.getState().today).toBe(MOCK_TODAY);
  });

  it("toggleDone flips status and persists to localStorage", () => {
    useTasksStore.getState().toggleDone("d5");
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")!.status).toBe("done");
    const stored = JSON.parse(localStorage.getItem("desk.tasks")!);
    expect(stored.state.tasks.find((t: { id: string }) => t.id === "d5").status).toBe("done");
  });

  it("deleteTask stashes recentlyDeleted and restoreTask brings it back", () => {
    const before = useTasksStore.getState().tasks.length;
    useTasksStore.getState().deleteTask("d6");
    expect(useTasksStore.getState().tasks).toHaveLength(before - 1);
    expect(useTasksStore.getState().recentlyDeleted?.task.id).toBe("d6");
    useTasksStore.getState().restoreTask();
    expect(useTasksStore.getState().tasks).toHaveLength(before);
    expect(useTasksStore.getState().recentlyDeleted).toBeNull();
  });

  it("addTodayTask adds a task scheduled for store.today", () => {
    useTasksStore.getState().addTodayTask("臨時一件");
    const added = useTasksStore.getState().tasks.find((t) => t.title === "臨時一件");
    expect(added?.custom_fields.scheduled_dates).toEqual([MOCK_TODAY]);
    expect(added?.custom_fields.is_adhoc).toBe("true");
  });

  it("setDailyPriority routes through store.today for eviction", () => {
    // d1 已是 daily_priority=1;把 d5 設成 1 應把 d1 擠掉
    useTasksStore.getState().setDailyPriority("d5", "1");
    const s = useTasksStore.getState();
    expect(s.tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority).toBe("1");
    expect(s.tasks.find((t) => t.id === "d1")!.custom_fields.daily_priority).toBeUndefined();
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npm test -- --run src/store/tasks.test.ts`
Expected: FAIL,`Failed to resolve import "./tasks"`。

- [ ] **步驟 3:寫最小實作**

```typescript
// src/store/tasks.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Priority, Task } from "@/lib/types";
import { allTasks, MOCK_TODAY } from "@/mock/data";
import {
  addTodayTask,
  deleteTask,
  editTitle,
  restoreTask,
  setDailyPriority,
  toggleDone,
  type RemovedTask,
} from "./taskOps";

interface TasksState {
  tasks: Task[];
  today: string;
  recentlyDeleted: RemovedTask | null;
  toggleDone: (id: string) => void;
  addTodayTask: (title: string) => void;
  editTitle: (id: string, title: string) => void;
  deleteTask: (id: string) => void;
  restoreTask: () => void;
  clearRecentlyDeleted: () => void;
  setDailyPriority: (id: string, n: Priority | null) => void;
}

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: allTasks,
      today: MOCK_TODAY,
      recentlyDeleted: null,
      toggleDone: (id) => set({ tasks: toggleDone(get().tasks, id, now()) }),
      addTodayTask: (title) =>
        set({ tasks: addTodayTask(get().tasks, title, get().today, newId(), now()) }),
      editTitle: (id, title) => set({ tasks: editTitle(get().tasks, id, title, now()) }),
      deleteTask: (id) => {
        const { tasks, removed } = deleteTask(get().tasks, id);
        set({ tasks, recentlyDeleted: removed });
      },
      restoreTask: () => {
        const removed = get().recentlyDeleted;
        if (!removed) return;
        set({ tasks: restoreTask(get().tasks, removed), recentlyDeleted: null });
      },
      clearRecentlyDeleted: () => set({ recentlyDeleted: null }),
      setDailyPriority: (id, n) =>
        set({ tasks: setDailyPriority(get().tasks, id, n, get().today) }),
    }),
    {
      name: "desk.tasks",
      // 只持久化資料,不持久化 actions / 暫存的 recentlyDeleted
      partialize: (s) => ({ tasks: s.tasks, today: s.today }),
    },
  ),
);
```

- [ ] **步驟 4:跑測試確認通過**

Run: `npm test -- --run src/store/tasks.test.ts`
Expected: PASS(5 個測試)。

- [ ] **步驟 5:Commit**

```bash
git add src/store/tasks.ts src/store/tasks.test.ts
git commit -m "feat(slice-1): useTasksStore（zustand + persist + seed）"
```

---

## Task 8: 接線資料流（page / layout 改讀 store，維持畫面不變）

此 task 把資料來源從「mock import + props」換成 store,但**還不加任何互動 UI**,只確認畫面與既有測試不變。

**檔案:**

- 修改:`src/pages/TodayPage.tsx`、`src/pages/PlanPage.tsx`
- 修改:`src/features/plan-view/TodayLayout.tsx`、`src/features/plan-view/PlanLayout.tsx`

- [ ] **步驟 1:`TodayPage` 改讀 store**

```typescript
// src/pages/TodayPage.tsx
import { TodayLayout } from "@/features/plan-view/TodayLayout";
import { useTasksStore } from "@/store/tasks";
import { currentMonthISO } from "@/lib/date";

export function TodayPage() {
  const tasks = useTasksStore((s) => s.tasks);
  const today = useTasksStore((s) => s.today);
  return (
    <TodayLayout allTasks={tasks} selectedDate={today} today={today} month={currentMonthISO(new Date(today + "T00:00:00"))} />
  );
}
```

- [ ] **步驟 2:`PlanPage` 改讀 store**

```typescript
// src/pages/PlanPage.tsx
import { PlanLayout } from "@/features/plan-view/PlanLayout";
import { useTasksStore } from "@/store/tasks";
import { currentMonthISO } from "@/lib/date";

export function PlanPage() {
  const tasks = useTasksStore((s) => s.tasks);
  const today = useTasksStore((s) => s.today);
  return (
    <PlanLayout allTasks={tasks} selectedDate={today} month={currentMonthISO(new Date(today + "T00:00:00"))} />
  );
}
```

> `TodayLayout` / `PlanLayout` 的 props 介面此時不變(仍收 `allTasks` / `selectedDate` / `month`),只是來源換成 store。`CarryoverBanner` 與 mock 常數(`MOCK_CARRYOVER_*`)維持原樣 — carryover 寫入是 Slice 6 範圍。

- [ ] **步驟 3:跑全部測試 + 啟動 dev server 目視**

Run: `npm test -- --run`
Expected: 全 PASS(taskOps 16 + tasks 5 + 既有 21 = 42)。

Run: `npm run dev`,瀏覽 `http://localhost:5173/today` 與 `/plan`
Expected: 畫面與 Slice 0 完全相同(資料現在來自 store)。

- [ ] **步驟 4:Commit**

```bash
git add src/pages/TodayPage.tsx src/pages/PlanPage.tsx
git commit -m "refactor(slice-1): page 改從 store 讀,移除 mock import"
```

---

## Task 9: PriorityRing UI component

**檔案:**

- 新增:`src/ui/PriorityRing/PriorityRing.tsx`、`PriorityRing.module.css`、`index.ts`
- 測試:`src/ui/PriorityRing/PriorityRing.test.tsx`

- [ ] **步驟 1:寫失敗的測試**

```tsx
// src/ui/PriorityRing/PriorityRing.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PriorityRing } from "./PriorityRing";

describe("PriorityRing", () => {
  it("shows the number when a priority is set", () => {
    render(<PriorityRing value="2" onClick={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("2");
  });

  it("renders an empty (add) ring when value is null", () => {
    render(<PriorityRing value={null} onClick={() => {}} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "設為今日重點");
  });

  it("fires onClick", async () => {
    const onClick = vi.fn();
    render(<PriorityRing value="1" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

> `@testing-library/user-event` 已隨 Testing Library 進來;若 import 失敗,先 `npm install -D @testing-library/user-event` 並在該 commit 一併加入。

- [ ] **步驟 2:跑測試確認失敗**

Run: `npm test -- --run src/ui/PriorityRing/PriorityRing.test.tsx`
Expected: FAIL,import 失敗。

- [ ] **步驟 3:寫最小實作**

```tsx
// src/ui/PriorityRing/PriorityRing.tsx
import type { Priority } from "@/lib/types";
import styles from "./PriorityRing.module.css";

export interface PriorityRingProps {
  value: Priority | null;
  onClick: () => void;
  disabled?: boolean;
}

export function PriorityRing({ value, onClick, disabled }: PriorityRingProps) {
  const isSet = value !== null;
  return (
    <button
      type="button"
      className={[styles.ring, isSet ? styles.solid : styles.empty].join(" ")}
      onClick={onClick}
      disabled={disabled}
      aria-label={isSet ? `今日重點第 ${value}` : "設為今日重點"}
    >
      {isSet ? value : "+"}
    </button>
  );
}
```

```css
/* src/ui/PriorityRing/PriorityRing.module.css */
.ring {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  background: transparent;
  cursor: pointer;
  padding: 0;
}
.solid {
  border: 2px solid var(--color-flag, #c1432e);
  color: var(--color-flag, #c1432e);
}
.empty {
  border: 2px dashed var(--color-border, #b9ab8e);
  color: var(--color-muted, #b9ab8e);
  font-size: 14px;
}
.ring:disabled {
  cursor: default;
  opacity: 0.5;
}
```

```typescript
// src/ui/PriorityRing/index.ts
export { PriorityRing } from "./PriorityRing";
export type { PriorityRingProps } from "./PriorityRing";
```

- [ ] **步驟 4:跑測試確認通過**

Run: `npm test -- --run src/ui/PriorityRing/PriorityRing.test.tsx`
Expected: PASS(3 個測試)。

- [ ] **步驟 5:Commit**

```bash
git add src/ui/PriorityRing/
git commit -m "feat(slice-1): PriorityRing UI component"
```

---

## Task 10: useTaskRow hook（共用單列互動）

**檔案:**

- 新增:`src/features/day/useTaskRow.ts`
- 測試:`src/features/day/useTaskRow.test.ts`

- [ ] **步驟 1:寫失敗的測試**

```tsx
// src/features/day/useTaskRow.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTaskRow } from "./useTaskRow";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";

beforeEach(() => {
  localStorage.clear();
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, recentlyDeleted: null });
});

describe("useTaskRow", () => {
  it("cyclePriority steps null -> 1 -> 2 -> 3 -> null", () => {
    const { result } = renderHook(() => useTaskRow("d5")); // d5 無 daily_priority
    act(() => result.current.cyclePriority());
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority).toBe("1");
  });

  it("startEdit / commitEdit writes the draft via the store", () => {
    const { result } = renderHook(() => useTaskRow("d5"));
    act(() => result.current.startEdit("讀文件"));
    expect(result.current.isEditing).toBe(true);
    act(() => result.current.changeDraft("讀完文件"));
    act(() => result.current.commitEdit());
    expect(result.current.isEditing).toBe(false);
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")!.title).toBe("讀完文件");
  });

  it("cancelEdit leaves the title untouched", () => {
    const { result } = renderHook(() => useTaskRow("d5"));
    act(() => result.current.startEdit("讀文件"));
    act(() => result.current.changeDraft("亂改"));
    act(() => result.current.cancelEdit());
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")!.title).toBe("讀 WSPC custom fields 文件");
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npm test -- --run src/features/day/useTaskRow.test.ts`
Expected: FAIL,import 失敗。

- [ ] **步驟 3:寫最小實作**

```typescript
// src/features/day/useTaskRow.ts
import { useState } from "react";
import type { Priority } from "@/lib/types";
import { useTasksStore } from "@/store/tasks";

function nextPriority(p: Priority | null): Priority | null {
  if (p === null) return "1";
  if (p === "1") return "2";
  if (p === "2") return "3";
  return null;
}

export function useTaskRow(id: string) {
  const toggleDone = useTasksStore((s) => s.toggleDone);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const editTitle = useTasksStore((s) => s.editTitle);
  const setDailyPriority = useTasksStore((s) => s.setDailyPriority);
  const current = useTasksStore((s) => s.tasks.find((t) => t.id === id));

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  return {
    isEditing,
    draft,
    toggle: () => toggleDone(id),
    remove: () => deleteTask(id),
    cyclePriority: () =>
      setDailyPriority(id, nextPriority(current?.custom_fields.daily_priority ?? null)),
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

- [ ] **步驟 4:跑測試確認通過**

Run: `npm test -- --run src/features/day/useTaskRow.test.ts`
Expected: PASS(3 個測試)。

- [ ] **步驟 5:Commit**

```bash
git add src/features/day/useTaskRow.ts src/features/day/useTaskRow.test.ts
git commit -m "feat(slice-1): useTaskRow 共用單列互動 hook"
```

---

## Task 11: TaskRow 改造（可互動）

**檔案:**

- 修改:`src/features/day/TaskRow.tsx`、`src/features/day/TaskRow.module.css`
- 測試:`src/features/day/TaskRow.test.tsx`

- [ ] **步驟 1:寫失敗的測試**

```tsx
// src/features/day/TaskRow.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskRow } from "./TaskRow";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";

beforeEach(() => {
  localStorage.clear();
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, recentlyDeleted: null });
});

function rowFor(id: string) {
  const task = useTasksStore.getState().tasks.find((t) => t.id === id)!;
  return <TaskRow task={task} kind="primary" interactive />;
}

describe("TaskRow (interactive)", () => {
  it("toggles done when the checkbox is clicked", async () => {
    render(rowFor("d5"));
    await userEvent.click(screen.getByRole("checkbox"));
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")!.status).toBe("done");
  });

  it("deletes when the trash button is clicked", async () => {
    render(rowFor("d5"));
    await userEvent.click(screen.getByLabelText("刪除"));
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")).toBeUndefined();
  });

  it("edits the title via the edit button + Enter", async () => {
    render(rowFor("d5"));
    await userEvent.click(screen.getByLabelText("編輯"));
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "新內容{Enter}");
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")!.title).toBe("新內容");
  });

  it("is read-only when interactive is false", () => {
    const task = useTasksStore.getState().tasks.find((t) => t.id === "d5")!;
    render(<TaskRow task={task} kind="primary" interactive={false} />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.queryByLabelText("刪除")).toBeNull();
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npm test -- --run src/features/day/TaskRow.test.tsx`
Expected: FAIL(`interactive` prop 不存在 / checkbox 仍 disabled / 找不到刪除鈕)。

- [ ] **步驟 3:寫最小實作**

```tsx
// src/features/day/TaskRow.tsx
import type { Task, TrailKind } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import { PriorityRing } from "@/ui/PriorityRing";
import { useTaskRow } from "./useTaskRow";
import styles from "./TaskRow.module.css";

export interface TaskRowProps {
  task: Task;
  kind: TrailKind;
  showAdhocChip?: boolean;
  interactive?: boolean;
  showRing?: boolean;
}

export function TaskRow({ task, kind, showAdhocChip, interactive, showRing }: TaskRowProps) {
  const isDone = task.status === "done";
  const isAdhoc = task.custom_fields.is_adhoc === "true";
  const row = useTaskRow(task.id);
  // 只有 primary + interactive 才開放寫入;trail（軌跡）維持唯讀
  const editable = Boolean(interactive) && kind === "primary";

  return (
    <div
      className={[styles.row, styles[`k_${kind}`], isDone && styles.done].filter(Boolean).join(" ")}
    >
      <Checkbox
        checked={isDone}
        disabled={!editable}
        onCheckedChange={editable ? row.toggle : undefined}
        aria-label={task.title}
      />
      {showRing && editable && (
        <PriorityRing value={task.custom_fields.daily_priority ?? null} onClick={row.cyclePriority} />
      )}
      <div className={styles.body}>
        {row.isEditing ? (
          <input
            className={styles.editInput}
            autoFocus
            value={row.draft}
            onChange={(e) => row.changeDraft(e.target.value)}
            onBlur={row.cancelEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") row.commitEdit();
              if (e.key === "Escape") row.cancelEdit();
            }}
          />
        ) : (
          <div className={styles.titleRow}>
            <span className={styles.title}>{task.title}</span>
            {kind === "forwarded" && <span className={styles.trail}>↪ 已順延</span>}
            {kind === "dismissed" && <span className={styles.trail}>· 已略過</span>}
          </div>
        )}
        {task.description && <div className={styles.desc}>{task.description}</div>}
      </div>
      {showAdhocChip && isAdhoc && <UnplannedChip />}
      {editable && !row.isEditing && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="編輯"
            onClick={() => row.startEdit(task.title)}
          >
            ✎
          </button>
          <button
            type="button"
            className={[styles.iconBtn, styles.del].join(" ")}
            aria-label="刪除"
            onClick={row.remove}
          >
            🗑
          </button>
        </div>
      )}
    </div>
  );
}
```

加到 `TaskRow.module.css`(沿用既有檔案的變數風格):

```css
.actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.row:hover .actions {
  opacity: 1;
}
.iconBtn {
  border: none;
  background: transparent;
  cursor: pointer;
  width: 24px;
  height: 24px;
  border-radius: 5px;
  font-size: 13px;
  color: var(--color-muted, #9a8e72);
}
.iconBtn:hover {
  background: var(--color-surface-hover, rgba(0, 0, 0, 0.05));
}
.del {
  color: var(--color-flag, #c1432e);
}
.editInput {
  width: 100%;
  font: inherit;
  border: 1.5px solid var(--color-flag, #c1432e);
  border-radius: 5px;
  padding: 4px 8px;
  background: var(--color-surface, #fffdf7);
  color: inherit;
}
/* mobile fallback：窄螢幕沒 hover，按鈕常駐 */
@media (max-width: 640px) {
  .actions {
    opacity: 1;
  }
}
```

- [ ] **步驟 4:跑測試確認通過**

Run: `npm test -- --run src/features/day/TaskRow.test.tsx`
Expected: PASS(4 個測試)。

- [ ] **步驟 5:Commit**

```bash
git add src/features/day/TaskRow.tsx src/features/day/TaskRow.module.css src/features/day/TaskRow.test.tsx
git commit -m "feat(slice-1): TaskRow 可互動（勾選/編輯/刪除/ring）"
```

---

## Task 12: Top3Card 改造（與 TaskRow 共用互動）

**檔案:**

- 修改:`src/features/day/Top3Card.tsx`、`src/features/day/Top3Card.module.css`
- 測試:`src/features/day/Top3Card.test.tsx`

- [ ] **步驟 1:寫失敗的測試**

```tsx
// src/features/day/Top3Card.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Top3Card } from "./Top3Card";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";

beforeEach(() => {
  localStorage.clear();
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, recentlyDeleted: null });
});

describe("Top3Card (interactive)", () => {
  it("toggles done for a top-3 task", async () => {
    const tasks = useTasksStore.getState().tasks.filter((t) => t.id === "d1");
    render(<Top3Card tasks={tasks} title="今天最重要的三件事" interactive />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d1")!.status).toBe("done");
  });

  it("stays read-only when interactive is false", () => {
    const tasks = useTasksStore.getState().tasks.filter((t) => t.id === "d1");
    render(<Top3Card tasks={tasks} title="x" interactive={false} />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npm test -- --run src/features/day/Top3Card.test.tsx`
Expected: FAIL(checkbox 仍 disabled / 無 `interactive`)。

- [ ] **步驟 3:寫最小實作**

把 `Top3Card` 的每個 item 接上 `useTaskRow`(checkbox 解除 disabled、可改序號 / 刪除),視覺維持 accent 卡片。將 item 抽成內部子元件以便對每個 task 呼叫 hook:

```tsx
// src/features/day/Top3Card.tsx
import type { Task } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { PlannedRefChip } from "@/ui/Chip";
import { PriorityRing } from "@/ui/PriorityRing";
import { useTaskRow } from "./useTaskRow";
import styles from "./Top3Card.module.css";

export interface Top3CardProps {
  tasks: Task[];
  title: string;
  variant?: "accent" | "plain";
  showParentRef?: boolean;
  parentTitleById?: Record<string, string>;
  interactive?: boolean;
}

export function Top3Card({
  tasks,
  title,
  variant = "accent",
  showParentRef,
  parentTitleById,
  interactive,
}: Top3CardProps) {
  return (
    <div className={[styles.card, styles[`v_${variant}`]].join(" ")}>
      <h3 className={styles.heading}>{title}</h3>
      <ul className={styles.list}>
        {tasks.map((t) => (
          <Top3Item
            key={t.id}
            task={t}
            showParentRef={showParentRef}
            parentTitleById={parentTitleById}
            interactive={interactive}
          />
        ))}
      </ul>
    </div>
  );
}

function Top3Item({
  task: t,
  showParentRef,
  parentTitleById,
  interactive,
}: {
  task: Task;
  showParentRef?: boolean;
  parentTitleById?: Record<string, string>;
  interactive?: boolean;
}) {
  const row = useTaskRow(t.id);
  const order = (t.custom_fields.daily_priority ?? t.custom_fields.monthly_priority) as
    | "1"
    | "2"
    | "3"
    | undefined;
  const parentTitle =
    showParentRef && t.parent_id && parentTitleById ? parentTitleById[t.parent_id] : null;

  return (
    <li className={styles.item}>
      {interactive ? (
        <PriorityRing value={t.custom_fields.daily_priority ?? null} onClick={row.cyclePriority} />
      ) : (
        order && <span className={styles.ring}>{order}</span>
      )}
      <div className={styles.itemBody}>
        {row.isEditing ? (
          <input
            className={styles.editInput}
            autoFocus
            value={row.draft}
            onChange={(e) => row.changeDraft(e.target.value)}
            onBlur={row.cancelEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") row.commitEdit();
              if (e.key === "Escape") row.cancelEdit();
            }}
          />
        ) : (
          <div
            className={styles.itemTitle}
            onDoubleClick={interactive ? () => row.startEdit(t.title) : undefined}
          >
            {t.title}
          </div>
        )}
        {parentTitle && (
          <div className={styles.parentRef}>
            <PlannedRefChip order={order ?? "1"} />
            <span className={styles.parentRefText}>{parentTitle}</span>
          </div>
        )}
      </div>
      {interactive && !row.isEditing && (
        <button type="button" className={styles.iconBtn} aria-label="刪除" onClick={row.remove}>
          🗑
        </button>
      )}
      <Checkbox
        variant="accent"
        checked={t.status === "done"}
        disabled={!interactive}
        onCheckedChange={interactive ? row.toggle : undefined}
        aria-label={t.title}
      />
    </li>
  );
}
```

加到 `Top3Card.module.css`:

```css
.iconBtn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-flag, #c1432e);
  opacity: 0;
  transition: opacity 0.12s ease;
}
.item:hover .iconBtn {
  opacity: 1;
}
.editInput {
  width: 100%;
  font: inherit;
  border: 1.5px solid var(--color-flag, #c1432e);
  border-radius: 5px;
  padding: 4px 8px;
  background: var(--color-surface, #fffdf7);
  color: inherit;
}
@media (max-width: 640px) {
  .iconBtn {
    opacity: 1;
  }
}
```

> 編輯入口在卡片內用**雙擊標題**(卡片空間較緊、不放 ✎ 按鈕);刪除用 hover 🗑,與一般 row 的視覺密度一致。

- [ ] **步驟 4:跑測試確認通過**

Run: `npm test -- --run src/features/day/Top3Card.test.tsx`
Expected: PASS(2 個測試)。

- [ ] **步驟 5:Commit**

```bash
git add src/features/day/Top3Card.tsx src/features/day/Top3Card.module.css src/features/day/Top3Card.test.tsx
git commit -m "feat(slice-1): Top3Card 可互動（共用 useTaskRow）"
```

---

## Task 13: AddTaskInput + 接進 DayColumn

**檔案:**

- 新增:`src/features/day/AddTaskInput.tsx`、`AddTaskInput.module.css`
- 測試:`src/features/day/AddTaskInput.test.tsx`
- 修改:`src/features/day/DayColumn.tsx`

- [ ] **步驟 1:寫失敗的測試**

```tsx
// src/features/day/AddTaskInput.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddTaskInput } from "./AddTaskInput";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";

beforeEach(() => {
  localStorage.clear();
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, recentlyDeleted: null });
});

describe("AddTaskInput", () => {
  it("adds a task on Enter and clears the field", async () => {
    render(<AddTaskInput />);
    const input = screen.getByPlaceholderText("+ 加一件今天的事…");
    await userEvent.type(input, "新的一件{Enter}");
    expect(useTasksStore.getState().tasks.some((t) => t.title === "新的一件")).toBe(true);
    expect(input).toHaveValue("");
  });

  it("does not add a blank task", async () => {
    render(<AddTaskInput />);
    const before = useTasksStore.getState().tasks.length;
    await userEvent.type(screen.getByPlaceholderText("+ 加一件今天的事…"), "   {Enter}");
    expect(useTasksStore.getState().tasks).toHaveLength(before);
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npm test -- --run src/features/day/AddTaskInput.test.tsx`
Expected: FAIL,import 失敗。

- [ ] **步驟 3:寫最小實作**

```tsx
// src/features/day/AddTaskInput.tsx
import { useState } from "react";
import { useTasksStore } from "@/store/tasks";
import styles from "./AddTaskInput.module.css";

export function AddTaskInput() {
  const addTodayTask = useTasksStore((s) => s.addTodayTask);
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim()) {
      setValue("");
      return;
    }
    addTodayTask(value);
    setValue("");
  };

  return (
    <div className={styles.bar}>
      <span className={styles.box} aria-hidden />
      <input
        className={styles.input}
        placeholder="+ 加一件今天的事…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
    </div>
  );
}
```

```css
/* src/features/day/AddTaskInput.module.css */
.bar {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  margin-top: 8px;
  border: 1.5px solid var(--color-border, #d8cdb6);
  border-radius: 7px;
  background: var(--color-surface, #fffdf7);
}
.bar:focus-within {
  border-color: var(--color-flag, #c1432e);
}
.box {
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--color-border, #b9ab8e);
  border-radius: 4px;
  flex: none;
}
.input {
  flex: 1;
  border: none;
  background: transparent;
  font: inherit;
  color: inherit;
  outline: none;
}
```

- [ ] **步驟 4:接進 `DayColumn`(只在 today-hero、互動時顯示)**

修改 `src/features/day/DayColumn.tsx`:加一個 `interactive` 推導與 `AddTaskInput`,並把 `interactive` / `showRing` 往下傳。

```tsx
// 在 import 區加：
import { AddTaskInput } from "./AddTaskInput";

// 在 component 內、return 前加：
const interactive = variant === "today-hero";
```

- 把 `Top3Card` 呼叫加上 `interactive={interactive}`。
- 「其他計劃內」與「今天臨時加的」的 `<TaskRow>` 加上 `interactive={interactive}` 與 `showRing={interactive}`。
- 在最外層 `</div>` 之前、`trails` 區之後加:

```tsx
{interactive && <AddTaskInput />}
```

> 軌跡區(`trails`)的 `TaskRow` **不傳** `interactive`,維持唯讀。Plan mode 的 DayColumn(`plan-narrow`)`interactive` 為 false,整欄唯讀。

- [ ] **步驟 5:跑測試確認通過**

Run: `npm test -- --run src/features/day/AddTaskInput.test.tsx`
Expected: PASS(2 個測試)。

Run: `npm test -- --run`
Expected: 全部 PASS。

- [ ] **步驟 6:Commit**

```bash
git add src/features/day/AddTaskInput.tsx src/features/day/AddTaskInput.module.css src/features/day/AddTaskInput.test.tsx src/features/day/DayColumn.tsx
git commit -m "feat(slice-1): AddTaskInput 常駐新增輸入列 + 接進 DayColumn"
```

---

## Task 14: DeleteUndoToast + 接進 TodayLayout

**檔案:**

- 新增:`src/features/day/DeleteUndoToast.tsx`、`DeleteUndoToast.module.css`
- 測試:`src/features/day/DeleteUndoToast.test.tsx`
- 修改:`src/features/plan-view/TodayLayout.tsx`

- [ ] **步驟 1:寫失敗的測試**

```tsx
// src/features/day/DeleteUndoToast.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteUndoToast } from "./DeleteUndoToast";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";

beforeEach(() => {
  localStorage.clear();
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, recentlyDeleted: null });
});

describe("DeleteUndoToast", () => {
  it("shows nothing when there is no recently deleted task", () => {
    render(<DeleteUndoToast />);
    expect(screen.queryByText("復原")).toBeNull();
  });

  it("appears after a delete and restores on click", async () => {
    useTasksStore.getState().deleteTask("d6");
    render(<DeleteUndoToast />);
    expect(screen.getByText(/已刪除/)).toBeInTheDocument();
    await userEvent.click(screen.getByText("復原"));
    expect(useTasksStore.getState().tasks.some((t) => t.id === "d6")).toBe(true);
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npm test -- --run src/features/day/DeleteUndoToast.test.tsx`
Expected: FAIL,import 失敗。

- [ ] **步驟 3:寫最小實作**

```tsx
// src/features/day/DeleteUndoToast.tsx
import { useEffect } from "react";
import { useTasksStore } from "@/store/tasks";
import styles from "./DeleteUndoToast.module.css";

export function DeleteUndoToast() {
  const recentlyDeleted = useTasksStore((s) => s.recentlyDeleted);
  const restoreTask = useTasksStore((s) => s.restoreTask);
  const clear = useTasksStore((s) => s.clearRecentlyDeleted);

  useEffect(() => {
    if (!recentlyDeleted) return;
    const timer = setTimeout(clear, 5000);
    return () => clearTimeout(timer);
  }, [recentlyDeleted, clear]);

  if (!recentlyDeleted) return null;

  return (
    <div className={styles.toast} role="status">
      <span>已刪除「{recentlyDeleted.task.title}」</span>
      <button type="button" className={styles.undo} onClick={restoreTask}>
        復原
      </button>
    </div>
  );
}
```

```css
/* src/features/day/DeleteUndoToast.module.css */
.toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  border-radius: 8px;
  background: var(--color-ink, #2c2a25);
  color: var(--color-paper, #f5f1e8);
  font-size: 13px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  z-index: 50;
}
.undo {
  border: none;
  background: transparent;
  color: var(--color-flag, #e0876f);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
```

- [ ] **步驟 4:接進 `TodayLayout`**

修改 `src/features/plan-view/TodayLayout.tsx`:import 並在 `</main>` 之前掛上 `<DeleteUndoToast />`。

```tsx
// import 區加：
import { DeleteUndoToast } from "@/features/day/DeleteUndoToast";

// 在 </main> 前加：
<DeleteUndoToast />
```

- [ ] **步驟 5:跑測試確認通過**

Run: `npm test -- --run src/features/day/DeleteUndoToast.test.tsx`
Expected: PASS(2 個測試)。

- [ ] **步驟 6:Commit**

```bash
git add src/features/day/DeleteUndoToast.tsx src/features/day/DeleteUndoToast.module.css src/features/day/DeleteUndoToast.test.tsx src/features/plan-view/TodayLayout.tsx
git commit -m "feat(slice-1): DeleteUndoToast 刪除復原提示"
```

---

## Task 15: 空狀態文案

**檔案:**

- 修改:`src/features/day/DayColumn.tsx`、`src/features/day/DayColumn.module.css`

- [ ] **步驟 1:寫失敗的測試**

```tsx
// 加到 src/features/day/AddTaskInput.test.tsx 或新增 DayColumn.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DayColumn } from "./DayColumn";
import { useTasksStore } from "@/store/tasks";
import { MOCK_TODAY } from "@/mock/data";

beforeEach(() => {
  localStorage.clear();
  useTasksStore.setState({ tasks: [], today: MOCK_TODAY, recentlyDeleted: null });
});

describe("DayColumn empty state", () => {
  it("shows an encouragement message when there is nothing today", () => {
    const tasks = useTasksStore.getState().tasks;
    render(<DayColumn allTasks={tasks} selectedDate={MOCK_TODAY} variant="today-hero" />);
    expect(screen.getByText("今天還很空白")).toBeInTheDocument();
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npm test -- --run src/features/day/DayColumn.test.tsx`
Expected: FAIL,找不到「今天還很空白」。

- [ ] **步驟 3:寫最小實作**

在 `DayColumn.tsx` 計算是否完全沒有 entries(`top3 / otherPlanned / adhoc / trails` 全空),且 `interactive`,在 `AddTaskInput` 上方插入空狀態:

```tsx
const isEmpty =
  top3.length === 0 && otherPlanned.length === 0 && adhoc.length === 0 && trails.length === 0;

// 在 {interactive && <AddTaskInput />} 之前：
{interactive && isEmpty && (
  <div className={styles.empty}>
    <div className={styles.emptyBig}>今天還很空白</div>
    <div className={styles.emptySub}>從下面加一件最想推進的事吧</div>
  </div>
)}
```

```css
/* 加到 DayColumn.module.css */
.empty {
  text-align: center;
  padding: 28px 12px 12px;
}
.emptyBig {
  font-size: 15px;
  color: var(--color-ink, #2c2a25);
  margin-bottom: 4px;
}
.emptySub {
  font-size: 12px;
  color: var(--color-muted, #8a7d63);
}
```

- [ ] **步驟 4:跑測試確認通過**

Run: `npm test -- --run src/features/day/DayColumn.test.tsx`
Expected: PASS。

- [ ] **步驟 5:Commit**

```bash
git add src/features/day/DayColumn.tsx src/features/day/DayColumn.module.css src/features/day/DayColumn.test.tsx
git commit -m "feat(slice-1): Today 空狀態文案"
```

---

## Task 16: Playwright e2e（現在跑通）

**檔案:**

- 新增:`playwright.config.ts`、`e2e/today-interaction.spec.ts`
- 修改:`package.json`(加 `test:e2e` script)、`.gitignore`(加 `test-results/`、`playwright-report/`)

- [ ] **步驟 1:安裝 Playwright**

Run: `npm install -D @playwright/test && npx playwright install chromium`
Expected: 安裝成功。

- [ ] **步驟 2:寫設定檔**

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **步驟 3:寫 e2e(資料來源無關設計)**

```typescript
// e2e/today-interaction.spec.ts
import { test, expect } from "@playwright/test";

// 每個 case 從乾淨的 seed 開始;清掉 localStorage 後 store 會重新 seed mock。
test.beforeEach(async ({ page }) => {
  await page.goto("/today");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("adds a task and persists it across reload", async ({ page }) => {
  const input = page.getByPlaceholder("+ 加一件今天的事…");
  await input.fill("打電話給水電師傅");
  await input.press("Enter");
  await expect(page.getByText("打電話給水電師傅")).toBeVisible();

  await page.reload();
  await expect(page.getByText("打電話給水電師傅")).toBeVisible();
});

test("completes a task via its checkbox", async ({ page }) => {
  const row = page.locator("text=讀 WSPC custom fields 文件").locator("xpath=ancestor::div[1]");
  await row.getByRole("checkbox").click();
  await expect(row.getByRole("checkbox")).toBeChecked();
});

test("deletes a task and undoes it", async ({ page }) => {
  const title = "回覆 Acme 客戶整合詢問";
  const row = page.locator(`text=${title}`).locator("xpath=ancestor::div[1]");
  await row.hover();
  await row.getByLabel("刪除").click();
  await expect(page.getByText(title)).toHaveCount(0);

  await page.getByText("復原").click();
  await expect(page.getByText(title)).toBeVisible();
});
```

> e2e 用使用者可見的文字 / placeholder / aria-label 定位,不依賴 mock 的內部 id,因此 WSPC 接上、資料改由 API 提供後,只要種子情境含同類 task 即可沿用。新增 / 刪除這兩個 case 自己造資料,完全與 mock 內容無關。

- [ ] **步驟 4:加 script + gitignore**

`package.json` 的 `scripts` 加:`"test:e2e": "playwright test"`。
`.gitignore` 加:`test-results/` 與 `playwright-report/`。

- [ ] **步驟 5:跑 e2e 確認通過**

Run: `npm run test:e2e`
Expected: 3 個 e2e 全 PASS(Playwright 會自動起 dev server)。

- [ ] **步驟 6:Commit**

```bash
git add playwright.config.ts e2e/ package.json package-lock.json .gitignore
git commit -m "test(slice-1): Playwright e2e（Today 互動 + 持久化）"
```

---

## Task 17: 手動驗收（agent 用 Claude Code preview + 截圖）

由執行的 agent 用 `preview_*` 工具實際操作 Today mode 並截圖確認,**不需人類介入**。此 task 不改 production code;若過程中發現 bug,回到對應 task 用 systematic-debugging 修。

- [ ] **步驟 1:啟動 preview**

用 `preview_start` 啟動 dev server,再用 `preview_eval` 執行 `window.location.href = '/today'`。

- [ ] **步驟 2:確認初始畫面與無 console error**

- `preview_snapshot`:確認「今天最重要的三件事」卡片、「其他計劃內」、「今天臨時加的」三區都在。
- `preview_console_logs`:確認沒有 error。
- `preview_screenshot`:留存初始畫面。

- [ ] **步驟 3:新增任務**

- `preview_fill`:在「+ 加一件今天的事…」輸入「驗收用任務」並送出(Enter)。
- `preview_snapshot`:確認新任務出現在「今天臨時加的」區、帶「臨時」chip。
- `preview_screenshot`:留存。

- [ ] **步驟 4:完成 / 取消完成**

- `preview_click`:點某個 task 的 checkbox。
- `preview_snapshot` + `preview_screenshot`:確認變灰 + 刪除線、留原位不跳動。
- 再點一次,確認可取消完成。

- [ ] **步驟 5:priority ring 騰位**

- `preview_click`:點一個「其他計劃內」task 的虛線空 ring。
- `preview_snapshot`:確認它升進三件事、且原本佔該序號者被擠回「其他計劃內」(驗證自動騰位)。
- `preview_screenshot`:留存。

- [ ] **步驟 6:inline 編輯**

- `preview_click`:hover 一個 row 後點 ✎(或對 Top3 雙擊標題)。
- `preview_fill`:改標題並按 Enter。
- `preview_snapshot`:確認標題更新;再試 Esc 取消不寫入。

- [ ] **步驟 7:刪除 + 復原**

- `preview_click`:hover row 後點 🗑。
- `preview_snapshot`:確認 row 消失、底部出現「已刪除 · 復原」toast。
- `preview_click`:點「復原」,確認 task 回來。

- [ ] **步驟 8:持久化**

- `preview_eval`:`window.location.reload()`。
- `preview_snapshot`:確認步驟 3 新增的任務在刷新後仍在。

- [ ] **步驟 9:mobile fallback**

- `preview_resize`:寬度設 390(手機寬)。
- `preview_snapshot` + `preview_screenshot`:確認 ✎ / 🗑 在窄螢幕常駐顯示(無需 hover)。

- [ ] **步驟 10:留存驗收截圖,記錄結果**

把關鍵 `preview_screenshot`(初始 / 新增 / 完成 / 騰位 / mobile)整理進回報。全部通過才算此 task 完成。

---

## 收尾

- [ ] **跑完整測試套件**

Run: `npm test -- --run && npm run test:e2e && npm run lint`
Expected: 全部 PASS、lint 無錯。

- [ ] **更新 ROADMAP**

把 Slice 1 表格狀態從「📝 設計完成,待實作」改為「✅ 完成」並補上 PR 連結;勾掉 Slice 1 的 checklist 項目。Commit。

- [ ] **完成開發分支**

使用 superpowers:finishing-a-development-branch 決定 merge / PR。

---

## 自我檢查結果(寫計畫時已核對 spec)

- **Spec 涵蓋**:狀態管理(Task 7)、各 action 語意(Task 2–6)、完成留原位(Task 11 + 手動 Task 17)、新增(Task 13)、編輯空白取消(Task 4/10/11)、刪除 + undo(Task 5/14)、priority 騰位(Task 6/9/10)、Top3 共用互動(Task 12)、Plan 唯讀讀 store(Task 8)、mobile fallback(Task 11)、測試策略(Task 2–15 單元/component + Task 16 e2e + Task 17 手動)。皆有對應 task。
- **type 一致性**:`RemovedTask`(Task 5)被 Task 7 store 沿用;`useTaskRow` 回傳的 `toggle/remove/cyclePriority/startEdit/changeDraft/commitEdit/cancelEdit/isEditing/draft`(Task 10)被 Task 11/12 一致使用;`Priority` 型別跨 taskOps / store / ring / hook 一致。
- **無 placeholder**:每個 code 步驟都有完整實作;手動驗收(Task 17)為刻意的人工/agent 操作步驟,非 code placeholder。
