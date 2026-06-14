# Slice 5 剩項 + 移除 carryover banner 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目標:** 補完 Slice 5 的月層級動作(移到下月 / 丟回 Backlog)、軌跡列可勾完成、把 Focus 的 MonthDigest 精簡為唯讀摘要 + 回 Plan 連結,並移除靜態 carryover banner。

**架構:** 全程貼現有分層 —— 純函式 op(`taskOps.ts`)→ store action(`tasks.ts`,樂觀更新 + 失敗回滾)→ `useMonthRow` hook → 共用 menu builder / 元件。新增一條全端欄位 `unscheduled_month`(前端 `TodoPatch` 型別 + worker PATCH 路由)。

**技術棧:** React 18 + TypeScript、zustand、TanStack Router、Vitest + Testing Library、Playwright(e2e)、Cloudflare Workers(BFF)。

> **設計文件:** [docs/superpowers/specs/2026-06-14-slice-5-dismiss-unschedule-design.md](../specs/2026-06-14-slice-5-dismiss-unschedule-design.md)
>
> **約定:** 每個 commit message 結尾都加一行 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`(下方步驟為簡潔用 `-m`,實際 commit 請補上 trailer)。型別檢查一律用 `npm run build`,**不要**用 `tsc -p ... --noEmit`(no-op 假綠)。安裝相依套件需 `--legacy-peer-deps`。

---

## 與設計文件的兩點微調(實作時採用)

1. **`moveToNextMonth` 不需外傳 `nextMonth`**:下個月由任務自己的 `last(scheduled_months)` 推導(`monthOf(addMonths(last + "-01", 1))`),與 today / 當前檢視月無關,語意更正確。op 簽名為 `moveToNextMonth(tasks, id)`。
2. 其餘與設計一致。

---

## Task 1: `moveToNextMonth` 純函式 op

**Files:**
- Modify: `src/store/taskOps.ts`(在 `demoteToMonth` 之後新增)
- Test: `src/store/taskOps.test.ts`

- [ ] **Step 1: 寫失敗測試**

在 `src/store/taskOps.test.ts` 末尾(import 區確認有 `import { describe, it, expect } from "vitest"`)加入:

```typescript
import { moveToNextMonth } from "./taskOps";

function monthTask(id: string, months: string[], priority?: string): Task {
  return {
    id,
    title: id,
    status: "open",
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    custom_fields: {
      scheduled_months: months,
      ...(priority ? { monthly_priority: priority } : {}),
    },
  };
}

describe("moveToNextMonth", () => {
  it("appends the next month and clears monthly_priority", () => {
    const tasks = [monthTask("a", ["2026-06"], "1")];
    const next = moveToNextMonth(tasks, "a");
    expect(next[0].custom_fields.scheduled_months).toEqual(["2026-06", "2026-07"]);
    expect(next[0].custom_fields.monthly_priority).toBeUndefined();
  });

  it("rolls over the year (12 -> next Jan)", () => {
    const tasks = [monthTask("a", ["2026-12"])];
    const next = moveToNextMonth(tasks, "a");
    expect(next[0].custom_fields.scheduled_months).toEqual(["2026-12", "2027-01"]);
  });

  it("is a no-op when the task has no scheduled month", () => {
    const tasks = [monthTask("a", [])];
    expect(moveToNextMonth(tasks, "a")).toBe(tasks);
  });

  it("is a no-op for an unknown id", () => {
    const tasks = [monthTask("a", ["2026-06"])];
    expect(moveToNextMonth(tasks, "zzz")).toBe(tasks);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/store/taskOps.test.ts -t moveToNextMonth`
Expected: FAIL(`moveToNextMonth` is not exported / not a function)

- [ ] **Step 3: 實作**

在 `src/store/taskOps.ts` 頂部 import 補 `addMonths`(已存在於 `@/lib/date`):

```typescript
import { monthOf, addMonths } from "@/lib/date";
```

在檔案末尾 `demoteToMonth` 之後新增:

```typescript
export function moveToNextMonth(tasks: Task[], id: string): Task[] {
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;
  const months = target.custom_fields.scheduled_months ?? [];
  if (months.length === 0) return tasks; // not a month task
  const last = months[months.length - 1];
  const nextMonth = monthOf(addMonths(`${last}-01`, 1));
  return tasks.map((t) =>
    t.id === id
      ? patch(t, { scheduled_months: [...months, nextMonth], monthly_priority: undefined })
      : t,
  );
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/store/taskOps.test.ts -t moveToNextMonth`
Expected: PASS(4 個)

- [ ] **Step 5: Commit**

```bash
git add src/store/taskOps.ts src/store/taskOps.test.ts
git commit -m "feat(taskOps): add moveToNextMonth (append next month, clear rank)"
```

---

## Task 2: `demoteToBacklog` 純函式 op

**Files:**
- Modify: `src/store/taskOps.ts`(在 `moveToNextMonth` 之後)
- Test: `src/store/taskOps.test.ts`

- [ ] **Step 1: 寫失敗測試**

在 `src/store/taskOps.test.ts` 加入(沿用 Task 1 的 `monthTask` helper):

```typescript
import { demoteToBacklog } from "./taskOps";
import { layer } from "@/lib/tasks";

describe("demoteToBacklog", () => {
  it("dismisses the active month and lands in backlog", () => {
    const tasks = [monthTask("a", ["2026-06"], "2")];
    const next = demoteToBacklog(tasks, "a", "2026-06-14");
    expect(next[0].custom_fields.unscheduled_month).toBe("2026-06");
    expect(next[0].custom_fields.unscheduled_at).toBe("2026-06-14");
    expect(next[0].custom_fields.monthly_priority).toBeUndefined();
    expect(next[0].custom_fields.daily_priority).toBeUndefined();
    expect(layer(next[0])).toBe("backlog");
  });

  it("is a no-op when the task has no scheduled month", () => {
    const tasks = [monthTask("a", [])];
    expect(demoteToBacklog(tasks, "a", "2026-06-14")).toBe(tasks);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/store/taskOps.test.ts -t demoteToBacklog`
Expected: FAIL(`demoteToBacklog` is not a function)

- [ ] **Step 3: 實作**

在 `src/store/taskOps.ts` 的 `moveToNextMonth` 之後新增:

```typescript
export function demoteToBacklog(tasks: Task[], id: string, today: string): Task[] {
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;
  const months = target.custom_fields.scheduled_months ?? [];
  if (months.length === 0) return tasks; // already backlog
  return tasks.map((t) =>
    t.id === id
      ? patch(t, {
          unscheduled_month: months[months.length - 1], // dismiss active month
          unscheduled_at: today, // also dismiss any residual day scheduling
          monthly_priority: undefined,
          daily_priority: undefined,
        })
      : t,
  );
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/store/taskOps.test.ts -t demoteToBacklog`
Expected: PASS(2 個)

- [ ] **Step 5: Commit**

```bash
git add src/store/taskOps.ts src/store/taskOps.test.ts
git commit -m "feat(taskOps): add demoteToBacklog (dismiss month + day, clear ranks)"
```

---

## Task 3: 全端補 `unscheduled_month` patch 欄位

`demoteToBacklog` 會寫 `unscheduled_month`,但前端 `TodoPatch` 型別與 worker PATCH 路由目前都只認 `unscheduled_at`。本 task 補上 `unscheduled_month` 的全端管線。

**Files:**
- Modify: `src/lib/api/todo.ts:42`(`TodoPatch` 介面)
- Modify: `worker/routes/todo.ts:65-67`、`78-80`、`92`(PATCH body 型別兩處 + customFields 映射)
- Test: `worker/routes/todo.test.ts`

- [ ] **Step 1: 寫失敗測試**

先看 `worker/routes/todo.test.ts` 既有一條 PATCH 測試的寫法(找對 `unscheduled_at` 的斷言當範本),在其旁新增一條驗證 `unscheduled_month` 會被轉進 `customFields`。範例(依該檔既有 mock 結構微調 import 與 helper 名稱):

```typescript
it("forwards unscheduled_month into customFields on PATCH", async () => {
  const { patchSpy } = setupPatchTest(); // 沿用該檔既有的 PATCH 測試 setup helper
  await app.fetch(
    new Request("http://x/api/todo/t1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: SESSION_COOKIE },
      body: JSON.stringify({ unscheduled_month: "2026-06" }),
    }),
    env,
  );
  expect(patchSpy).toHaveBeenCalledWith(
    expect.anything(),
    "t1",
    expect.objectContaining({
      customFields: expect.objectContaining({ unscheduled_month: "2026-06" }),
    }),
  );
});
```

> 若 `worker/routes/todo.test.ts` 既有的 PATCH 測試用的是別種 setup(例如直接 mock `patchTodo`),照該檔現有 pattern 改寫這條 —— 重點是斷言「body 帶 `unscheduled_month` → `patchTodo` 收到 `customFields.unscheduled_month`」。

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run worker/routes/todo.test.ts -t unscheduled_month`
Expected: FAIL(`customFields` 不含 `unscheduled_month`)

- [ ] **Step 3: 實作 — 前端型別**

`src/lib/api/todo.ts`,在 `TodoPatch` 介面的 `unscheduled_at?: string;`(line 42)下一行加:

```typescript
  unscheduled_month?: string;
```

- [ ] **Step 4: 實作 — worker 路由**

`worker/routes/todo.ts`,在兩處 PATCH body 型別宣告(各自的 `unscheduled_at?: string;`,line 67 與 80)後面各加:

```typescript
      unscheduled_month?: string;
```

並在 customFields 映射區(line 92 的 `unscheduled_at` 之後)加:

```typescript
    if ("unscheduled_month" in body && body.unscheduled_month)
      customFields.unscheduled_month = body.unscheduled_month;
```

- [ ] **Step 5: 跑測試 + 型別**

Run: `npx vitest run worker/routes/todo.test.ts -t unscheduled_month`
Expected: PASS

Run: `npm run build`
Expected: 型別全過(無錯誤)

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/todo.ts worker/routes/todo.ts worker/routes/todo.test.ts
git commit -m "feat(todo-api): persist unscheduled_month on PATCH (front + worker)"
```

---

## Task 4: store actions `moveToNextMonth` / `demoteToBacklog`

**Files:**
- Modify: `src/store/tasks.ts`(import、interface、實作)
- Test: `src/store/tasks.test.ts`

- [ ] **Step 1: 寫失敗測試**

在 `src/store/tasks.test.ts` 找既有 `demoteToMonth` 的 store 測試當範本(它示範了如何 mock `enqueuePatch` 並斷言樂觀更新與回滾)。新增兩組:

```typescript
describe("store.moveToNextMonth", () => {
  it("optimistically appends next month and clears rank, then patches", async () => {
    // seed store with a task scheduled in 2026-06 with monthly_priority "1"
    // (沿用該檔既有的 seed helper / setState 寫法)
    seedTasks([monthTask("a", ["2026-06"], "1")]);
    await useTasksStore.getState().moveToNextMonth("a");
    const t = useTasksStore.getState().tasks.find((x) => x.id === "a")!;
    expect(t.custom_fields.scheduled_months).toEqual(["2026-06", "2026-07"]);
    expect(t.custom_fields.monthly_priority).toBeUndefined();
    expect(enqueuePatchMock).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({ scheduled_months: ["2026-06", "2026-07"], monthly_priority: null }),
    );
  });

  it("rolls back on patch failure", async () => {
    enqueuePatchMock.mockRejectedValueOnce(new Error("boom"));
    seedTasks([monthTask("a", ["2026-06"], "1")]);
    await useTasksStore.getState().moveToNextMonth("a");
    const t = useTasksStore.getState().tasks.find((x) => x.id === "a")!;
    expect(t.custom_fields.scheduled_months).toEqual(["2026-06"]);
    expect(useTasksStore.getState().error).toBe("save_failed");
  });
});

describe("store.demoteToBacklog", () => {
  it("optimistically dismisses month + day and patches null ranks", async () => {
    seedTasks([monthTask("a", ["2026-06"], "2")]);
    useTasksStore.setState({ today: "2026-06-14" });
    await useTasksStore.getState().demoteToBacklog("a");
    const t = useTasksStore.getState().tasks.find((x) => x.id === "a")!;
    expect(t.custom_fields.unscheduled_month).toBe("2026-06");
    expect(t.custom_fields.unscheduled_at).toBe("2026-06-14");
    expect(enqueuePatchMock).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({
        unscheduled_month: "2026-06",
        unscheduled_at: "2026-06-14",
        monthly_priority: null,
        daily_priority: null,
      }),
    );
  });
});
```

> `monthTask` / `seedTasks` / `enqueuePatchMock` 請對照 `src/store/tasks.test.ts` 既有 helper 命名沿用;若該檔用別的 seed 方式(如直接 `useTasksStore.setState({ tasks: [...] })`),照既有寫法。

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/store/tasks.test.ts -t "moveToNextMonth|demoteToBacklog"`
Expected: FAIL(action 不存在)

- [ ] **Step 3: 實作**

`src/store/tasks.ts`:

import 區(line 5-20 的 `./taskOps` 匯入)補:

```typescript
  moveToNextMonth as moveToNextMonthOp,
  demoteToBacklog as demoteToBacklogOp,
```

`TasksState` interface(`demoteToMonth` 那行附近)補:

```typescript
  moveToNextMonth: (id: string) => Promise<void>;
  demoteToBacklog: (id: string) => Promise<void>;
```

在 `demoteToMonth` 實作(約 line 316)之後新增:

```typescript
  async moveToNextMonth(id) {
    const prev = get().tasks;
    const next = moveToNextMonthOp(prev, id);
    if (next === prev) return;
    set({ tasks: next, error: null });
    const updated = next.find((t) => t.id === id)!;
    try {
      await enqueuePatch(id, {
        scheduled_months: updated.custom_fields.scheduled_months,
        monthly_priority: null,
      });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async demoteToBacklog(id) {
    const prev = get().tasks;
    const next = demoteToBacklogOp(prev, id, get().today);
    if (next === prev) return;
    set({ tasks: next, error: null });
    const updated = next.find((t) => t.id === id)!;
    try {
      await enqueuePatch(id, {
        unscheduled_month: updated.custom_fields.unscheduled_month,
        unscheduled_at: updated.custom_fields.unscheduled_at,
        monthly_priority: null,
        daily_priority: null,
      });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/store/tasks.test.ts -t "moveToNextMonth|demoteToBacklog"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/tasks.ts src/store/tasks.test.ts
git commit -m "feat(store): moveToNextMonth + demoteToBacklog actions (optimistic + rollback)"
```

---

## Task 5: 抽 `buildMonthRowMenuItems` 共用 + 加兩個月動作

`MonthRow`([MonthRow.tsx:99](../../../src/features/month/MonthRow.tsx))與 `MonthHeroItem`([MonthHeroCard.tsx:92](../../../src/features/month/MonthHeroCard.tsx))的 `⋯` menu 目前是兩份**完全相同**的 inline 陣列。抽成共用 builder(仿 [taskRowMenu.ts](../../../src/features/day/taskRowMenu.ts)),並加入「移到下月 / 丟回 Backlog」。

**Files:**
- Modify: `src/features/month/useMonthRow.ts`(加兩動作)
- Create: `src/features/month/monthRowMenu.ts`
- Modify: `src/features/month/MonthRow.tsx`、`src/features/month/MonthHeroCard.tsx`(改用 builder)
- Test: `src/features/month/MonthRow.test.tsx`

- [ ] **Step 1: `useMonthRow` 加兩動作**

`src/features/month/useMonthRow.ts`:store selector 區補:

```typescript
  const moveToNextMonth = useTasksStore((s) => s.moveToNextMonth);
  const demoteToBacklog = useTasksStore((s) => s.demoteToBacklog);
```

回傳物件補:

```typescript
    moveToNextMonth: () => moveToNextMonth(id),
    demoteToBacklog: () => demoteToBacklog(id),
```

- [ ] **Step 2: 建立共用 builder**

Create `src/features/month/monthRowMenu.ts`:

```typescript
import type { Task } from "@/lib/types";
import type { MenuItemSpec } from "@/ui/Menu/Menu";
import type { useMonthRow } from "./useMonthRow";

/**
 * Shared overflow-menu items for a month task row.
 *
 * Both MonthRow ("其他計劃內 / 計劃外" rows) and MonthHeroItem (本月三件大事 card)
 * render the same actions. Defining them here keeps the two call sites from
 * drifting — historically a new action was added to one and forgotten on the
 * other (same lesson as the day-side taskRowMenu).
 */
export function buildMonthRowMenuItems({
  task,
  selectedDate,
  row,
}: {
  task: Task;
  selectedDate: string;
  row: ReturnType<typeof useMonthRow>;
}): MenuItemSpec[] {
  const isAdhoc = task.custom_fields.is_adhoc === "true";
  const dayLabel = selectedDate.slice(8);
  return [
    { key: "promote-1", label: `→ ${dayLabel} 日 · ① 三件事`, onSelect: () => row.promote("1") },
    { key: "promote-2", label: `→ ${dayLabel} 日 · ② 三件事`, onSelect: () => row.promote("2") },
    { key: "promote-3", label: `→ ${dayLabel} 日 · ③ 三件事`, onSelect: () => row.promote("3") },
    { key: "promote-other", label: `→ ${dayLabel} 日 · 其他`, onSelect: () => row.promote() },
    { key: "move-next-month", label: "↪ 移到下月", onSelect: row.moveToNextMonth },
    { key: "demote-backlog", label: "↩ 丟回 Backlog", onSelect: row.demoteToBacklog },
    isAdhoc
      ? { key: "to-planned", label: "↑ 移到計畫內", onSelect: row.toggleAdhoc }
      : { key: "to-adhoc", label: "↓ 標為計畫外", onSelect: row.toggleAdhoc },
    { key: "edit", label: "編輯", onSelect: () => row.startEdit(task.title) },
    { key: "delete", label: "刪除", onSelect: row.remove, danger: true },
  ];
}
```

> 動手前先 diff `MonthRow` 與 `MonthHeroCard` 的兩份 items 陣列,確認除了上面列的之外沒有任一邊有額外項目(目前兩份相同)。

- [ ] **Step 3: 兩處改用 builder**

`src/features/month/MonthRow.tsx`:import 補 `import { buildMonthRowMenuItems } from "./monthRowMenu";`,把 `<Menu ariaLabel="更多動作" ...>` 的 `items={[ ...inline... ]}` 換成:

```tsx
            items={buildMonthRowMenuItems({ task, selectedDate, row })}
```

`src/features/month/MonthHeroCard.tsx`:同樣 import,把 `MonthHeroItem` 內 `<Menu ariaLabel="更多動作" ...>` 的 inline `items` 換成 `buildMonthRowMenuItems({ task, selectedDate, row })`。

- [ ] **Step 4: 寫 / 更新測試**

在 `src/features/month/MonthRow.test.tsx` 加一條(沿用該檔既有 render helper 與開 menu 的方式):

```typescript
it("month row menu includes 移到下月 and 丟回 Backlog", async () => {
  // render an interactive primary MonthRow, open the ⋯ menu
  // (沿用既有測試開 overflow menu 的 userEvent 流程)
  expect(screen.getByText("↪ 移到下月")).toBeInTheDocument();
  expect(screen.getByText("↩ 丟回 Backlog")).toBeInTheDocument();
});
```

- [ ] **Step 5: 跑測試 + 型別**

Run: `npx vitest run src/features/month/`
Expected: PASS(含既有 MonthRow / MonthHeroCard 測試不回歸)

Run: `npm run build`
Expected: 型別全過

- [ ] **Step 6: Commit**

```bash
git add src/features/month/
git commit -m "refactor(month): share row menu builder; add 移到下月 / 丟回 Backlog"
```

---

## Task 6: 軌跡列可勾完成(forwarded / dismissed)

把 `TaskRow` / `MonthRow` 的單一 `editable` 拆成 `editable`(primary 才有 menu/ring/編輯)與 `checkable`(任何 interactive 列都可勾 checkbox);並讓 DayColumn / MonthColumn 的 trail section 也傳 `interactive`。

**Files:**
- Modify: `src/features/day/TaskRow.tsx`、`src/features/month/MonthRow.tsx`
- Modify: `src/features/day/DayColumn.tsx:147`、`src/features/month/MonthColumn.tsx:113`
- Test: `src/features/day/TaskRow.test.tsx`

- [ ] **Step 1: 寫失敗測試**

在 `src/features/day/TaskRow.test.tsx` 加(沿用既有 render helper):

```typescript
it("a forwarded trail row is checkable but has no overflow menu", () => {
  renderTaskRow({ kind: "forwarded", interactive: true }); // 對照既有 helper 參數
  const checkbox = screen.getByRole("checkbox");
  expect(checkbox).not.toBeDisabled();
  expect(screen.queryByRole("button", { name: "更多動作" })).not.toBeInTheDocument();
});

it("a dismissed trail row is checkable", () => {
  renderTaskRow({ kind: "dismissed", interactive: true });
  expect(screen.getByRole("checkbox")).not.toBeDisabled();
});
```

> 若既有 `renderTaskRow` helper 不支援傳 `kind` / `interactive`,照該檔現有渲染方式直接傳 props 給 `<TaskRow kind="forwarded" interactive ... />`。

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/features/day/TaskRow.test.tsx -t "trail row"`
Expected: FAIL(checkbox 仍 disabled)

- [ ] **Step 3: 實作 — TaskRow**

`src/features/day/TaskRow.tsx`,在 `const editable = ...` 那行下方加 `checkable`,並改 checkbox:

```tsx
  const editable = Boolean(interactive) && kind === "primary";
  const checkable = Boolean(interactive);
```

```tsx
      <Checkbox
        checked={isDone}
        disabled={!checkable}
        onCheckedChange={checkable ? row.toggle : undefined}
        aria-label={task.title}
      />
```

(其餘 ring / menu / 編輯維持 `editable` 條件不變。)

- [ ] **Step 4: 實作 — MonthRow**

`src/features/month/MonthRow.tsx` 同樣:

```tsx
  const editable = Boolean(interactive) && kind === "primary";
  const checkable = Boolean(interactive);
```

```tsx
      <Checkbox
        checked={isDone}
        disabled={!checkable}
        onCheckedChange={checkable ? row.toggle : undefined}
        aria-label={task.title}
      />
```

- [ ] **Step 5: 實作 — trail section 傳 interactive**

`src/features/day/DayColumn.tsx`,trail 區(line 144-150)的 `<TaskRow>` 補 `interactive`:

```tsx
            <TaskRow
              key={e.task.id}
              task={e.task}
              kind={e.kind}
              date={selectedDate}
              interactive={isInteractive}
            />
```

`src/features/month/MonthColumn.tsx`,trail 區(line 110-122)的 `<MonthRow>` 補 `interactive`:

```tsx
            <MonthRow
              key={e.task.id}
              task={e.task}
              kind={e.kind}
              month={month}
              selectedDate={selectedDate}
              interactive
            />
```

(兩處都**不要**加 `showRing` —— 軌跡列不該出現 ring。)

- [ ] **Step 6: 跑測試 + 型別**

Run: `npx vitest run src/features/day/ src/features/month/`
Expected: PASS

Run: `npm run build`
Expected: 型別全過

- [ ] **Step 7: Commit**

```bash
git add src/features/day/ src/features/month/
git commit -m "feat(rows): trail rows (forwarded/dismissed) are checkable but read-only otherwise"
```

---

## Task 7: MonthDigest 精簡為唯讀摘要 + 回 Plan 連結

**Files:**
- Modify: `src/features/month/MonthDigest.tsx`
- Modify: `src/features/plan-view/TodayLayout.tsx:39-41`(傳 `selectedDate`)
- Test: `src/features/month/MonthDigest.test.tsx`(若無則新建)

- [ ] **Step 1: 寫 / 更新測試**

在 `src/features/month/MonthDigest.test.tsx`(沿用既有 render；需包 router 才能渲染 `<Link>`,參考 memory「standalone route-view tests need a router」——用 `createMemoryRouter` / 既有 test router helper 包起來):

```typescript
it("renders progress and top-3 but not the 其他 list, plus an edit link", () => {
  // seed: one top-3 month task + one non-priority month task in 2026-06
  renderMonthDigest({ month: "2026-06", today: "2026-06-14", selectedDate: "2026-06-14" });
  expect(screen.getByText("本月三件大事")).toBeInTheDocument();
  expect(screen.queryByText(/^其他 \(/)).not.toBeInTheDocument();
  const link = screen.getByRole("link", { name: /在計畫頁編輯本月/ });
  expect(link).toHaveAttribute("href", expect.stringContaining("/plan/2026-06-14"));
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/features/month/MonthDigest.test.tsx`
Expected: FAIL(仍渲染「其他」且無連結)

- [ ] **Step 3: 實作**

`src/features/month/MonthDigest.tsx`:

- 移除 `import { MonthRow } from "./MonthRow";`,改加 `import { Link } from "@tanstack/react-router";`。
- props 加 `selectedDate: string;`,函式簽名改 `({ allTasks, month, today, selectedDate })`。
- 移除 `others` 變數與整個 `{others.length > 0 && (...)}` section。
- 在 `Top3Card` 之後、`</div>` 之前加連結:

```tsx
      <Link to="/plan/$date" params={{ date: selectedDate }} className={styles.editLink}>
        在計畫頁編輯本月 →
      </Link>
```

- `primary` 變數**保留**(進度標籤 `completed/{primary.length}` 仍用它)。

在 `src/features/month/MonthDigest.module.css` 加一個 `.editLink` 樣式(對照 `WeekRail.module.css` 的 `.todayLink` 或既有連結樣式,小字、次要色、`margin-top`)。

- [ ] **Step 4: 傳 selectedDate**

`src/features/plan-view/TodayLayout.tsx`,把 MonthDigest 的渲染(line 39-41)改成:

```tsx
        <aside className={[styles.cell, styles.right].join(" ")}>
          <MonthDigest allTasks={allTasks} month={month} today={today} selectedDate={selectedDate} />
        </aside>
```

- [ ] **Step 5: 跑測試 + 型別**

Run: `npx vitest run src/features/month/MonthDigest.test.tsx`
Expected: PASS

Run: `npm run build`
Expected: 型別全過(`MonthDigest` 的 `selectedDate` 必填,確認唯一呼叫點 TodayLayout 已補上)

- [ ] **Step 6: Commit**

```bash
git add src/features/month/MonthDigest.tsx src/features/month/MonthDigest.module.css src/features/month/MonthDigest.test.tsx src/features/plan-view/TodayLayout.tsx
git commit -m "feat(month-digest): slim to progress + top-3 + edit link to Plan"
```

---

## Task 8: 移除 carryover banner

**Files:**
- Delete: `src/features/carryover/CarryoverBanner.tsx`、`src/features/carryover/CarryoverBanner.module.css`
- Modify: `src/features/plan-view/TodayLayout.tsx`、`src/features/plan-view/PlanLayout.tsx`
- Modify: `src/mock/data.ts`(移除 `MOCK_CARRYOVER_DAY` / `MOCK_CARRYOVER_MONTH`)

- [ ] **Step 1: 先盤點引用**

Run: `npx grep -n "CarryoverBanner\|MOCK_CARRYOVER" -r src` 或用編輯器搜尋。
確認引用點:`TodayLayout.tsx`(import + 使用 + `MOCK_CARRYOVER_DAY`)、`PlanLayout.tsx`(import + 使用 + `MOCK_CARRYOVER_MONTH`)、`src/mock/data.ts`(定義)。**逐一辨別**:任何含 "carryover" 但屬 per-row 動作(`moveToToday` / `demoteToMonth`)的測試**不要動**。

- [ ] **Step 2: 移除使用點**

`src/features/plan-view/TodayLayout.tsx`:刪 `import { CarryoverBanner } ...`、刪 `import { MOCK_CARRYOVER_DAY } ...`、刪整段 `<CarryoverBanner ... />`(line 25-30)。

`src/features/plan-view/PlanLayout.tsx`:刪 `import { CarryoverBanner } ...`、刪 `MOCK_CARRYOVER_MONTH` import、刪整段 `<CarryoverBanner ... />`(line 168-173)。

`src/mock/data.ts`:刪 `MOCK_CARRYOVER_DAY` 與 `MOCK_CARRYOVER_MONTH` 兩個 export(及其專屬型別 / 註解)。

- [ ] **Step 3: 刪元件檔**

```bash
git rm src/features/carryover/CarryoverBanner.tsx src/features/carryover/CarryoverBanner.module.css
```

(若 `src/features/carryover/` 還有其他檔則保留目錄;若空了讓 git 自然移除。)

- [ ] **Step 4: 型別 + 全測試**

Run: `npm run build`
Expected: 型別全過(無殘留 import)

Run: `npx vitest run`
Expected: 全綠(確認沒有測試還引用被刪的 banner / mock)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove static carryover banner (replaced by per-row actions)"
```

---

## Task 9: 全量驗證 + 手動驗收報告

> 本 task 依專案規則(見 [.claude/rules/acceptance-report.md](../../../.claude/rules/acceptance-report.md))全程用 `playwright-cli` 驗收並產出報告。

**Files:**
- Create: `docs/acceptance-reports/2026-06-14-slice-5-dismiss-unschedule/report.md`(gitignored)+ `assets/` 截圖

- [ ] **Step 1: 全量自動化**

Run: `npm run build`(型別)
Run: `npx vitest run`(全單元 / 元件)
Run: `npm run test:e2e`(Playwright,對真實 BFF + mock WSPC)
Expected: 三者全綠。e2e 若有涉及 banner 的舊斷言,更新之;新增涵蓋「軌跡列勾完成」「Plan 月列移到下月 / 丟回 Backlog」的案例。

- [ ] **Step 2: 啟 preview 並探測登入**

用共用 profile 啟動(見 [CLAUDE.md](../../../CLAUDE.md)「本機 preview 登入」):確認 dev server 未與 e2e 撞 port(先停 e2e server)。`playwright-cli open --persistent --profile ~/.desk-dev/pw-profile <url>`。已登入直接驗收;未登入請使用者協助 device flow。

- [ ] **Step 3: 逐項手動驗收(對照設計「驗收標準」1–10)**

每項用 `playwright-cli screenshot --filename docs/acceptance-reports/2026-06-14-slice-5-dismiss-unschedule/assets/<slug>.png` 落地截圖:

1. Plan 月列 `⋯` 出現「移到下月 / 丟回 Backlog」,且 MonthRow 與 MonthHeroCard 一致。
2. 移到下月:`scheduled_months` append、`monthly_priority` 清空,月欄即時反映。
3. 丟回 Backlog:任務離開月欄落回 backlog。
4. 動作失敗回滾 + 錯誤 toast(可暫時讓 worker 回 500 或斷網模擬,屬選測)。
5. 日軌跡列(順延 / 退回月度)可勾完成 → ✓ 樣式;其餘動作不出現。
6. Plan 月軌跡列可勾完成。
7. MonthDigest 只有「進度 + 本月三件大事 + 連結」,無「其他」。
8. 連結進入 `/plan/<焦點日>`。
9. Focus / Plan 都無 carryover banner、版面無破洞。
10. 自動化全綠(引用 Step 1 結果)。

- [ ] **Step 4: 寫報告**

依 [.claude/rules/acceptance-report.md](../../../.claude/rules/acceptance-report.md) 範本寫 `report.md`:逐項標 PASS/FAIL + 截圖連結 + 環境資訊。有 FAIL 則回前面對應 task 修正後重驗。

- [ ] **Step 5: 收尾**

確認分支可整合(全綠 + 驗收 PASS)。報告目錄已 gitignored,不進 commit。回報使用者結果並提供 finishing-a-development-branch 的整合選項。

---

## 自我檢查(已於撰寫後核對)

- **Spec 覆蓋**:A→Task 1/2,B→Task 5,C→Task 6,D→Task 7,E→Task 8,全端 `unscheduled_month`→Task 3,store→Task 4,測試策略→各 task + Task 9。
- **型別一致**:op `moveToNextMonth(tasks,id)` / `demoteToBacklog(tasks,id,today)`、store action 同名、`useMonthRow` 回傳 `moveToNextMonth` / `demoteToBacklog`、builder 用之 —— 全鏈一致。`TodoPatch.unscheduled_month`(前端)與 worker body 欄位同名。
- **無 placeholder**:每個 code step 均含實際程式碼;測試 helper 名稱處標明「沿用既有」並給出對照依據。
