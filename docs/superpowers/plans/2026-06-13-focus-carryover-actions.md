# 專注頁 carryover 逐列動作(移到今天 / 丟回月度)實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目標:** 在專注頁每一列任務的 `⋯` 選單加「移到今天」(順延、留軌跡)與「丟回月度」(退回本月)兩個動作。

**架構:** 沿用既有 append-only 資料模型。新增兩個 `taskOps` 純函式 → 兩個 `tasks` store action → `useTaskRow` 兩個包裝 → `TaskRow` 選單兩個條件式 item。另補 worker PATCH 路由讓 `unscheduled_at` 能持久化(目前白名單漏掉它)。

**技術棧:** React + TanStack Router、Zustand store、Vitest + Testing Library、Playwright(e2e)、Cloudflare Worker(BFF)。

> 設計來源:[2026-06-13-focus-carryover-actions-design.md](../specs/2026-06-13-focus-carryover-actions-design.md)。

> 慣例提醒:型別檢查一律 `npm run build`(不是 `tsc -p`);測試檔顯式 `import { describe, it, expect } from "vitest"`;安裝相依套件用 `npm install --legacy-peer-deps`。

---

### 任務 1:`moveToToday` 純函式

**檔案:**
- 修改:`src/store/taskOps.ts`(新增 `nextFreeDailySlot` 到既有 `@/lib/tasks` import;新增 `moveToToday`)
- 測試:`src/store/taskOps.test.ts`(新增 `primaryDate` import + `describe("moveToToday")`)

- [ ] **步驟 1:寫失敗測試**

在 `src/store/taskOps.test.ts` 的 import 區把 `primaryDate` 從 `@/lib/tasks` 引入,並把 `moveToToday` 加進 `./taskOps` 的 import list,然後在檔案末端加:

```ts
describe("moveToToday", () => {
  const today = "2026-05-22";

  it("appends today and keeps the earlier day as a trail", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_dates: ["2026-05-20"] } })];
    const next = moveToToday(tasks, "a", today);
    expect(next[0].custom_fields.scheduled_dates).toEqual(["2026-05-20", today]);
  });

  it("keeps the task a priority, reassigning it to a free slot on today", () => {
    const tasks = [
      makeTask({ id: "a", custom_fields: { scheduled_dates: ["2026-05-20"], daily_priority: "2" } }),
    ];
    const next = moveToToday(tasks, "a", today);
    expect(next[0].custom_fields.daily_priority).toBe("1");
  });

  it("drops to no priority when today's three-things is already full", () => {
    const onToday = (id: string, p: "1" | "2" | "3") =>
      makeTask({ id, custom_fields: { scheduled_dates: [today], daily_priority: p } });
    const tasks = [
      onToday("x", "1"),
      onToday("y", "2"),
      onToday("z", "3"),
      makeTask({ id: "a", custom_fields: { scheduled_dates: ["2026-05-20"], daily_priority: "1" } }),
    ];
    const next = moveToToday(tasks, "a", today);
    expect(next.find((t) => t.id === "a")!.custom_fields.daily_priority).toBeUndefined();
  });

  it("leaves a non-priority task without priority", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_dates: ["2026-05-20"] } })];
    const next = moveToToday(tasks, "a", today);
    expect(next[0].custom_fields.daily_priority).toBeUndefined();
  });

  it("is a no-op (same ref) when already on today", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_dates: [today] } })];
    expect(moveToToday(tasks, "a", today)).toBe(tasks);
  });

  it("returns the same ref when id is not found", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_dates: ["2026-05-20"] } })];
    expect(moveToToday(tasks, "zz", today)).toBe(tasks);
  });

  it("does not mutate the input array", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_dates: ["2026-05-20"] } })];
    const json = JSON.stringify(tasks);
    moveToToday(tasks, "a", today);
    expect(JSON.stringify(tasks)).toBe(json);
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npx vitest run src/store/taskOps.test.ts`
Expected: FAIL（`moveToToday is not exported` / `primaryDate` 未使用或未定義）

- [ ] **步驟 3:實作 `moveToToday`**

在 `src/store/taskOps.ts`,把第 2 行 import 改成同時引入 `nextFreeDailySlot`:

```ts
import { primaryDate, primaryMonth, nextFreeDailySlot } from "@/lib/tasks";
```

在檔案末端(`planScheduleDay` 之後)新增:

```ts
export function moveToToday(tasks: Task[], id: string, today: string): Task[] {
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;
  const dates = target.custom_fields.scheduled_dates ?? [];
  if (dates[dates.length - 1] === today) return tasks; // already on today

  const nextDates = [...dates, today]; // append-only: origin day stays as a trail

  // Preserve "is a priority", but the exact slot doesn't matter — reassign to a
  // non-colliding slot on today. If today's three-things is already full, drop
  // the priority (land in "其他計劃內") rather than evict a deliberate pick.
  let nextPriority = target.custom_fields.daily_priority;
  if (nextPriority) {
    const takenByOthers = new Set(
      tasks
        .filter((t) => t.id !== id && primaryDate(t) === today && t.custom_fields.daily_priority)
        .map((t) => t.custom_fields.daily_priority),
    );
    nextPriority = takenByOthers.size >= 3 ? undefined : nextFreeDailySlot(tasks, today, id);
  }

  return tasks.map((t) =>
    t.id === id ? patch(t, { scheduled_dates: nextDates, daily_priority: nextPriority }) : t,
  );
}
```

- [ ] **步驟 4:跑測試確認通過**

Run: `npx vitest run src/store/taskOps.test.ts`
Expected: PASS

- [ ] **步驟 5:commit**

```bash
git add src/store/taskOps.ts src/store/taskOps.test.ts
git commit -m "feat(focus): moveToToday taskOp (forward unfinished task to today)"
```

---

### 任務 2:`demoteToMonth` 純函式

**檔案:**
- 修改:`src/store/taskOps.ts`(新增 `demoteToMonth`)
- 測試:`src/store/taskOps.test.ts`(新增 `describe("demoteToMonth")`;把 `demoteToMonth` 加進 import)

- [ ] **步驟 1:寫失敗測試**

把 `demoteToMonth` 加進 `./taskOps` import,然後在 `taskOps.test.ts` 末端加:

```ts
describe("demoteToMonth", () => {
  it("unschedules from the day and keeps the month it already belongs to", () => {
    const tasks = [
      makeTask({
        id: "a",
        custom_fields: { scheduled_months: ["2026-05"], scheduled_dates: ["2026-05-21"] },
      }),
    ];
    const next = demoteToMonth(tasks, "a", "2026-05");
    expect(next[0].custom_fields.unscheduled_at).toBe("2026-05-21");
    expect(next[0].custom_fields.scheduled_months).toEqual(["2026-05"]);
    expect(primaryDate(next[0])).toBeNull();
  });

  it("adds the current month for a day-only adhoc task that had no month", () => {
    const tasks = [
      makeTask({
        id: "a",
        custom_fields: { scheduled_dates: ["2026-05-21"], is_adhoc: "true" },
      }),
    ];
    const next = demoteToMonth(tasks, "a", "2026-05");
    expect(next[0].custom_fields.scheduled_months).toEqual(["2026-05"]);
    expect(next[0].custom_fields.is_adhoc).toBe("true"); // preserved
  });

  it("clears daily_priority", () => {
    const tasks = [
      makeTask({
        id: "a",
        custom_fields: {
          scheduled_months: ["2026-05"],
          scheduled_dates: ["2026-05-21"],
          daily_priority: "1",
        },
      }),
    ];
    const next = demoteToMonth(tasks, "a", "2026-05");
    expect(next[0].custom_fields.daily_priority).toBeUndefined();
  });

  it("preserves the scheduled_dates trail", () => {
    const tasks = [
      makeTask({
        id: "a",
        custom_fields: {
          scheduled_months: ["2026-05"],
          scheduled_dates: ["2026-05-19", "2026-05-21"],
        },
      }),
    ];
    const next = demoteToMonth(tasks, "a", "2026-05");
    expect(next[0].custom_fields.scheduled_dates).toEqual(["2026-05-19", "2026-05-21"]);
  });

  it("is a no-op (same ref) when the task is not on a day", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_months: ["2026-05"] } })];
    expect(demoteToMonth(tasks, "a", "2026-05")).toBe(tasks);
  });

  it("returns the same ref when id is not found", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_dates: ["2026-05-21"] } })];
    expect(demoteToMonth(tasks, "zz", "2026-05")).toBe(tasks);
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npx vitest run src/store/taskOps.test.ts`
Expected: FAIL（`demoteToMonth is not exported`）

- [ ] **步驟 3:實作 `demoteToMonth`**

在 `src/store/taskOps.ts` 末端(`moveToToday` 之後)新增:

```ts
export function demoteToMonth(tasks: Task[], id: string, currentMonth: string): Task[] {
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;
  const day = primaryDate(target);
  if (day === null) return tasks; // not on a day, nothing to demote

  const months = target.custom_fields.scheduled_months ?? [];
  // Land in the current month (今天所在月), unless it's already the active month.
  const nextMonths = primaryMonth(target) === currentMonth ? months : [...months, currentMonth];

  return tasks.map((t) =>
    t.id === id
      ? patch(t, {
          unscheduled_at: day, // leave the day layer; scheduled_dates trail is kept
          scheduled_months: nextMonths,
          daily_priority: undefined,
        })
      : t,
  );
}
```

- [ ] **步驟 4:跑測試確認通過**

Run: `npx vitest run src/store/taskOps.test.ts`
Expected: PASS

- [ ] **步驟 5:commit**

```bash
git add src/store/taskOps.ts src/store/taskOps.test.ts
git commit -m "feat(focus): demoteToMonth taskOp (drop a day task back to the month)"
```

---

### 任務 3:讓 `unscheduled_at` 能持久化(client + worker)

目前 `TodoPatch` 與 worker PATCH 白名單都沒有 `unscheduled_at`,丟回月度只會樂觀更新 UI、存不進 WSPC,reload 就消失。本任務補齊。

**檔案:**
- 修改:`src/lib/api/todo.ts`(`TodoPatch` 加 `unscheduled_at`)
- 修改:`worker/routes/todo.ts`(`handlePatchTodo` body 型別 + customFields 對應)
- 測試:`worker/routes/todo.test.ts`(新增一個 forward 測試)

- [ ] **步驟 1:寫失敗測試**

在 `worker/routes/todo.test.ts` 的 `describe("PATCH /api/todo/:id", ...)` 區塊內新增:

```ts
  it("forwards unscheduled_at as a custom field", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "patchTodo").mockResolvedValue({
      id: "tod_1", status: "open", title: "A", created_at: 0, updated_at: 0, custom_fields: {},
    });
    const req = new Request("https://d/api/todo/tod_1", {
      method: "PATCH",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        unscheduled_at: "2026-05-21",
        scheduled_months: ["2026-05"],
        daily_priority: null,
      }),
    });
    await handlePatchTodo(req, env, "tod_1");
    expect(spy.mock.calls[0][2]).toEqual({
      status: undefined,
      customFields: {
        unscheduled_at: "2026-05-21",
        scheduled_months: ["2026-05"],
        daily_priority: null,
      },
    });
  });
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npx vitest run worker/routes/todo.test.ts`
Expected: FAIL（`customFields` 缺 `unscheduled_at`)

- [ ] **步驟 3:實作**

在 `src/lib/api/todo.ts` 的 `TodoPatch` interface 加一行(放在 `scheduled_months?` 之後):

```ts
  scheduled_months?: string[];
  unscheduled_at?: string;
```

在 `worker/routes/todo.ts` 的 `handlePatchTodo`:**兩處** body 型別宣告(`let body: {...}` 與 `body = (await request.json()) as {...}`)都在 `scheduled_months?: string[];` 之後加 `unscheduled_at?: string;`;接著在 customFields 對應區(`scheduled_months` 那行之後)加:

```ts
    if ("scheduled_months" in body && body.scheduled_months) customFields.scheduled_months = body.scheduled_months;
    if ("unscheduled_at" in body && body.unscheduled_at) customFields.unscheduled_at = body.unscheduled_at;
```

- [ ] **步驟 4:跑測試 + 型別確認通過**

Run: `npx vitest run worker/routes/todo.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 型別綠（無錯誤）

- [ ] **步驟 5:commit**

```bash
git add src/lib/api/todo.ts worker/routes/todo.ts worker/routes/todo.test.ts
git commit -m "feat(bff): persist unscheduled_at through the PATCH /api/todo route"
```

---

### 任務 4:store actions `moveToToday` / `demoteToMonth`

**檔案:**
- 修改:`src/store/tasks.ts`(`TasksState` 介面 + import + 兩個 action)
- 測試:`src/store/tasks.test.ts`(兩個 action 的整合測試)

- [ ] **步驟 1:寫失敗測試**

在 `src/store/tasks.test.ts` 末端新增(import 區補 `currentMonthISO`,已從 `@/lib/date` 引入 `todayISO`):

```ts
describe("useTasksStore carryover actions", () => {
  it("moveToToday appends today and keeps the trail", async () => {
    vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    useTasksStore.setState({
      tasks: [
        {
          id: "p1", title: "順延我", status: "open", created_at: "x", updated_at: "x",
          custom_fields: { scheduled_dates: ["2026-05-20"] },
        },
      ],
      today: MOCK_TODAY,
      status: "ready",
    });
    await useTasksStore.getState().moveToToday("p1");
    const t = useTasksStore.getState().tasks.find((x) => x.id === "p1")!;
    expect(t.custom_fields.scheduled_dates).toEqual(["2026-05-20", MOCK_TODAY]);
  });

  it("demoteToMonth unschedules from the day and lands in the current month", async () => {
    vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    useTasksStore.setState({
      tasks: [
        {
          id: "p2", title: "退回我", status: "open", created_at: "x", updated_at: "x",
          custom_fields: { scheduled_dates: ["2026-05-21"], is_adhoc: "true" },
        },
      ],
      today: MOCK_TODAY,
      status: "ready",
    });
    await useTasksStore.getState().demoteToMonth("p2");
    const t = useTasksStore.getState().tasks.find((x) => x.id === "p2")!;
    expect(t.custom_fields.unscheduled_at).toBe("2026-05-21");
    expect(t.custom_fields.scheduled_months).toEqual(["2026-05"]); // MOCK_TODAY is 2026-05-22
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npx vitest run src/store/tasks.test.ts`
Expected: FAIL（`moveToToday` / `demoteToMonth` 不存在於 store）

- [ ] **步驟 3:實作 store actions**

在 `src/store/tasks.ts`:

import 區(`./taskOps`)補兩個別名,`@/lib/date` 補 `currentMonthISO`:

```ts
import {
  // ...既有 imports...
  planScheduleDay as planScheduleDayOp,
  moveToToday as moveToTodayOp,
  demoteToMonth as demoteToMonthOp,
  deleteTask,
  // ...
} from "./taskOps";
import { todayISO, currentMonthISO } from "@/lib/date";
```

`TasksState` interface 加兩行(放在 `planScheduleDay` 附近):

```ts
  moveToToday: (id: string) => Promise<void>;
  demoteToMonth: (id: string) => Promise<void>;
```

在 store 實作中(`planScheduleDay` action 之後)加:

```ts
  async moveToToday(id) {
    const prev = get().tasks;
    const next = moveToTodayOp(prev, id, get().today);
    if (next === prev) return;
    set({ tasks: next, error: null });
    const updated = next.find((t) => t.id === id)!;
    try {
      await enqueuePatch(id, {
        scheduled_dates: updated.custom_fields.scheduled_dates,
        daily_priority: updated.custom_fields.daily_priority ?? null,
      });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async demoteToMonth(id) {
    const prev = get().tasks;
    const month = currentMonthISO(new Date(get().today + "T00:00:00"));
    const next = demoteToMonthOp(prev, id, month);
    if (next === prev) return;
    set({ tasks: next, error: null });
    const updated = next.find((t) => t.id === id)!;
    try {
      await enqueuePatch(id, {
        unscheduled_at: updated.custom_fields.unscheduled_at,
        scheduled_months: updated.custom_fields.scheduled_months,
        daily_priority: null,
      });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },
```

- [ ] **步驟 4:跑測試確認通過**

Run: `npx vitest run src/store/tasks.test.ts`
Expected: PASS

- [ ] **步驟 5:commit**

```bash
git add src/store/tasks.ts src/store/tasks.test.ts
git commit -m "feat(focus): store actions for moveToToday / demoteToMonth"
```

---

### 任務 5:`useTaskRow` 包裝

**檔案:**
- 修改:`src/features/day/useTaskRow.ts`
- 測試:`src/features/day/useTaskRow.test.ts`

- [ ] **步驟 1:寫失敗測試**

在 `src/features/day/useTaskRow.test.ts` 末端(`describe("useTaskRow")` 內)加:

```ts
  it("moveToToday forwards the task to today via the store", async () => {
    useTasksStore.setState({
      tasks: [
        {
          id: "p1", title: "順延我", status: "open", created_at: "x", updated_at: "x",
          custom_fields: { scheduled_dates: ["2026-05-20"] },
        },
      ],
      today: MOCK_TODAY,
      status: "ready",
    });
    const { result } = renderHook(() => useTaskRow("p1", "2026-05-20"));
    await act(async () => result.current.moveToToday());
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "p1")!.custom_fields.scheduled_dates,
    ).toEqual(["2026-05-20", MOCK_TODAY]);
  });

  it("demoteToMonth drops the task from the day via the store", async () => {
    useTasksStore.setState({
      tasks: [
        {
          id: "p2", title: "退回我", status: "open", created_at: "x", updated_at: "x",
          custom_fields: { scheduled_dates: ["2026-05-21"] },
        },
      ],
      today: MOCK_TODAY,
      status: "ready",
    });
    const { result } = renderHook(() => useTaskRow("p2", "2026-05-21"));
    await act(async () => result.current.demoteToMonth());
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "p2")!.custom_fields.unscheduled_at,
    ).toBe("2026-05-21");
  });
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npx vitest run src/features/day/useTaskRow.test.ts`
Expected: FAIL（`result.current.moveToToday` 不是 function）

- [ ] **步驟 3:實作**

在 `src/features/day/useTaskRow.ts`:selector 區加兩行:

```ts
  const moveToToday = useTasksStore((s) => s.moveToToday);
  const demoteToMonth = useTasksStore((s) => s.demoteToMonth);
```

return 物件加兩個包裝(放在 `toggle` 附近):

```ts
    moveToToday: () => moveToToday(id),
    demoteToMonth: () => demoteToMonth(id),
```

- [ ] **步驟 4:跑測試確認通過**

Run: `npx vitest run src/features/day/useTaskRow.test.ts`
Expected: PASS

- [ ] **步驟 5:commit**

```bash
git add src/features/day/useTaskRow.ts src/features/day/useTaskRow.test.ts
git commit -m "feat(focus): useTaskRow wrappers for moveToToday / demoteToMonth"
```

---

### 任務 6:`TaskRow` 選單兩個動作 + 軌跡文字改「退回月度」

**檔案:**
- 修改:`src/features/day/TaskRow.tsx`
- 測試:`src/features/day/TaskRow.test.tsx`

- [ ] **步驟 1:寫失敗測試**

在 `src/features/day/TaskRow.test.tsx` import 區補 `currentMonthISO`:

```ts
import { currentMonthISO } from "@/lib/date";
```

在檔案末端新增:

```ts
describe("TaskRow carryover actions", () => {
  const PAST = "2026-05-20";
  function seed(task: Task) {
    useTasksStore.setState({ tasks: [task], today: MOCK_TODAY, status: "ready", error: null });
  }
  const pastTask = (): Task => ({
    id: "p1", title: "順延我", status: "open", created_at: "x", updated_at: "x",
    custom_fields: { scheduled_dates: [PAST], is_adhoc: "false" },
  });

  it("offers 移到今天 on a past day and forwards the task to today", async () => {
    const user = userEvent.setup();
    seed(pastTask());
    render(<TaskRow task={useTasksStore.getState().tasks[0]} kind="primary" date={PAST} interactive />);
    await user.click(screen.getByLabelText("更多動作"));
    await user.click(await screen.findByRole("menuitem", { name: /移到今天/ }));
    const t = useTasksStore.getState().tasks.find((x) => x.id === "p1")!;
    expect(t.custom_fields.scheduled_dates).toEqual([PAST, MOCK_TODAY]);
  });

  it("hides 移到今天 when viewing today", async () => {
    const user = userEvent.setup();
    seed({ ...pastTask(), custom_fields: { scheduled_dates: [MOCK_TODAY] } });
    render(<TaskRow task={useTasksStore.getState().tasks[0]} kind="primary" date={MOCK_TODAY} interactive />);
    await user.click(screen.getByLabelText("更多動作"));
    expect(screen.queryByRole("menuitem", { name: /移到今天/ })).toBeNull();
  });

  it("demotes a task back to the current month via 丟回月度", async () => {
    const user = userEvent.setup();
    seed(pastTask());
    render(<TaskRow task={useTasksStore.getState().tasks[0]} kind="primary" date={PAST} interactive />);
    await user.click(screen.getByLabelText("更多動作"));
    await user.click(await screen.findByRole("menuitem", { name: /丟回月度/ }));
    const t = useTasksStore.getState().tasks.find((x) => x.id === "p1")!;
    expect(t.custom_fields.unscheduled_at).toBe(PAST);
    expect(t.custom_fields.scheduled_months).toEqual([
      currentMonthISO(new Date(MOCK_TODAY + "T00:00:00")),
    ]);
  });

  it("renders a dismissed trail row as 退回月度", () => {
    render(
      <TaskRow
        task={{
          id: "d1", title: "已退回", status: "open", created_at: "x", updated_at: "x",
          custom_fields: { scheduled_dates: [PAST], unscheduled_at: PAST },
        }}
        kind="dismissed"
        date={PAST}
      />,
    );
    expect(screen.getByText("· 退回月度")).toBeInTheDocument();
  });
});
```

- [ ] **步驟 2:跑測試確認失敗**

Run: `npx vitest run src/features/day/TaskRow.test.tsx`
Expected: FAIL（找不到「移到今天」menuitem;且軌跡仍是「· 已略過」）

- [ ] **步驟 3:實作**

在 `src/features/day/TaskRow.tsx`:

(1) 檔案頂端 import 區補 store:

```ts
import { useTasksStore } from "@/store/tasks";
```

(2) 元件內(`const row = useTaskRow(...)` 附近)讀 `today`:

```ts
  const today = useTasksStore((s) => s.today);
```

(3) 把 `dismissed` 軌跡文字由「· 已略過」改成「· 退回月度」:

```tsx
            {kind === "dismissed" && <span className={styles.trail}>· 退回月度</span>}
```

(4) `⋯` Menu 的 `items` 陣列最前面條件式插入兩個動作(`date !== today` 才有「移到今天」):

```tsx
            items={[
              ...(date !== today
                ? [{ key: "move-today", label: "⤴ 移到今天", onSelect: row.moveToToday }]
                : []),
              { key: "demote-month", label: "↩ 丟回月度", onSelect: row.demoteToMonth },
              isAdhoc
                ? { key: "to-planned", label: "↑ 移到計畫內", onSelect: row.toggleAdhoc }
                : { key: "to-adhoc", label: "↓ 標為計畫外", onSelect: row.toggleAdhoc },
              { key: "edit", label: "編輯", onSelect: () => row.startEdit(task.title) },
              { key: "delete", label: "刪除", onSelect: row.remove, danger: true },
            ]}
```

- [ ] **步驟 4:跑測試確認通過**

Run: `npx vitest run src/features/day/TaskRow.test.tsx`
Expected: PASS

- [ ] **步驟 5:全套單元測試 + 型別**

Run: `npx vitest run`
Expected: PASS（全綠）

Run: `npm run build`
Expected: 型別綠

- [ ] **步驟 6:commit**

```bash
git add src/features/day/TaskRow.tsx src/features/day/TaskRow.test.tsx
git commit -m "feat(focus): row menu actions move-to-today / demote-to-month + 退回月度 trail copy"
```

---

### 任務 7:e2e

**檔案:**
- 建立:`e2e/focus-carryover.spec.ts`

> 依 CLAUDE.md:改到專注頁互動必跑 e2e。月層歸屬的精確語意已由任務 1/2/4 的 vitest 覆蓋;e2e 著重「翻到過去那天→動作→日視圖可觀察的結果」這條真實流程。
> 跑 e2e 前先確認 preview dev server 沒在跑(會搶 port);見記憶「desk e2e vs preview port collision」。

- [ ] **步驟 1:寫 e2e spec**

建立 `e2e/focus-carryover.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { gotoTodaySeeded } from "./fixtures/session";

const rowOf = (page: import("@playwright/test").Page, title: string) =>
  page
    .locator(`text=${title}`)
    .locator("xpath=ancestor::div[contains(@class,'row') and not(contains(@class,'titleRow'))]");

test("move-to-today forwards a past-day task into today", async ({ page }) => {
  await gotoTodaySeeded(page);
  const rail = page.getByRole("navigation", { name: "週導覽" });

  // navigate to yesterday (2026-05-21, within the seeded week)
  await rail.getByRole("link", { name: "切到 2026-05-21" }).click();
  await expect(page).toHaveURL(/\/focus\/2026-05-21$/);

  // add an open task on that past day
  const input = page.getByPlaceholder("+ 加一件這天的事…");
  await input.fill("順延 e2e");
  await input.press("Enter");

  // ⋯ → 移到今天
  const row = rowOf(page, "順延 e2e");
  await row.hover();
  await row.getByLabel("更多動作").click();
  await page.getByRole("menuitem", { name: /移到今天/ }).click();

  // back to today → it now lives here
  await rail.getByRole("link", { name: "回今天" }).click();
  await expect(page.getByText("順延 e2e")).toBeVisible();
});

test("demote-to-month turns a day task into a 退回月度 trail", async ({ page }) => {
  await gotoTodaySeeded(page);

  const input = page.getByPlaceholder("+ 加一件這天的事…");
  await input.fill("退回 e2e");
  await input.press("Enter");

  const row = rowOf(page, "退回 e2e");
  await row.hover();
  await row.getByLabel("更多動作").click();
  await page.getByRole("menuitem", { name: /丟回月度/ }).click();

  // it left the active list and now shows as a 退回月度 trail on this day
  await expect(page.getByText("· 退回月度")).toBeVisible();
});
```

- [ ] **步驟 2:跑 e2e**

Run: `npm run test:e2e`
Expected: 新增兩個 spec PASS,既有 e2e 全綠

- [ ] **步驟 3:commit**

```bash
git add e2e/focus-carryover.spec.ts
git commit -m "test(e2e): focus carryover row actions (move-to-today / demote-to-month)"
```

---

### 任務 8:更新 ROADMAP

**檔案:**
- 修改:`ROADMAP.md`

- [ ] **步驟 1:標記完成的子集**

在 `ROADMAP.md` 的 Slice 5 / Slice 6 區塊註明本次做掉的部份:Focus 逐列「移到今天」(順延、append + 留軌跡)與「丟回月度」(寫 `unscheduled_at` + 補本月)已完成;**仍待做**:略過、月層 carryover banner 動作、月底 review、移到「其他日期」。具體做法:在 Slice 5 的 checklist 把對應概念標 ✅ 並加一行說明,或於 Slice 6 上方加一段「已完成(部分)」備註,點出這是子集、列出剩餘項。措辭用繁體中文,與既有 ROADMAP 風格一致。

- [ ] **步驟 2:commit**

```bash
git add ROADMAP.md
git commit -m "docs(roadmap): mark Focus move-to-today / demote-to-month done (partial Slice 5/6)"
```

---

### 任務 9:手動驗收 + 產生驗收報告

依專案規範([.claude/rules/acceptance-report.md](../../../.claude/rules/acceptance-report.md),讀本 plan 時自動載入),最後一個 task 全程用 `playwright-cli` 手動驗收,報告寫到 gitignored 的 `docs/acceptance-reports/2026-06-13-focus-carryover-actions/`(截圖落在底下 `assets/`)。

- [ ] **步驟 1:啟動 preview 並探測登入狀態**

用共用 profile 開 preview(見 CLAUDE.md「本機 preview 登入」):
`playwright-cli open --persistent --profile ~/.desk-dev/pw-profile <preview-url>`
看畫面是否已登入(header 顯示帳號、能進 Focus)。**已登入直接驗收**;未登入才請使用者協助走一次 device flow。

- [ ] **步驟 2:逐項手動驗收(對照 spec 驗收標準)**

1. 翻到昨天/前天,primary 未完成任務 `⋯` 有「移到今天」;看今天時無此項。
2. 「丟回月度」在 primary 列恆顯示。
3. 移到今天:任務出現在今天(原本有 priority → 進三件事且不撞號;今天滿 → 落「其他計劃內」);原日變「↪ 已順延」軌跡。
4. 丟回月度:任務離開日欄、進本月月度清單(切到 Plan 月欄確認);只加在今天的臨時任務此時首次進月度;原日變「· 退回月度」軌跡;reload 後狀態仍在(驗證持久化)。
5. 各日期(昨天 / 前天 / 未來)行為一致。

每個關鍵步驟用 `playwright-cli screenshot --filename docs/acceptance-reports/2026-06-13-focus-carryover-actions/assets/<name>.png` 落地截圖。

- [ ] **步驟 3:寫驗收報告**

依 `.claude/rules/acceptance-report.md` 範本,把逐項結果 + 截圖引用寫到 `docs/acceptance-reports/2026-06-13-focus-carryover-actions/report.md`。

- [ ] **步驟 4:最終驗證**

Run: `npm run build` → 型別綠
Run: `npx vitest run` → 全綠
Run: `npm run test:e2e` → 全綠

報告為 gitignored,不需 commit;若驗收中發現需修的程式,回到對應任務修正並補測試。

---

## 自我檢查(已完成)

- **Spec 覆蓋**:移到今天(任務 1/4/6)、丟回月度(任務 2/3/4/6)、出現條件(任務 6)、軌跡文字(任務 6)、`unscheduled_at` 持久化(任務 3)、更新 ROADMAP(任務 8)、手動驗收(任務 9)。皆有對應任務。
- **Placeholder**:無 TBD / 待補;每個程式步驟都有完整碼。
- **型別 / 命名一致**:`moveToToday` / `demoteToMonth` 在純函式、store action、`useTaskRow`、`TaskRow` 全程同名;store 端以 `moveToTodayOp` / `demoteToMonthOp` 別名引入純函式,避免與 action 撞名(對齊既有 `planScheduleDayOp` 慣例)。
