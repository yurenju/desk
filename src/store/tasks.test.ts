import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTasksStore } from "./tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";
import * as api from "@/lib/api/todo";
import { resetTodoQueue } from "@/lib/api/todoQueue";
import * as queue from "@/lib/api/todoQueue";
import type { Task } from "@/lib/types";
import { todayISO } from "@/lib/date";
import { dailyRankOn, monthlyRankOn } from "@/lib/tasks";

// Silence unhandled floating-promise warnings from fire-and-forget store actions
// by ensuring all API calls are mocked by default.
beforeEach(() => {
  vi.restoreAllMocks();
  resetTodoQueue();
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, status: "ready", error: null, recentlyDeleted: null });
});

describe("useTasksStore (local behaviour)", () => {
  it("seeds today from MOCK_TODAY", () => {
    expect(useTasksStore.getState().today).toBe(MOCK_TODAY);
  });

  it("toggleDone flips status optimistically", async () => {
    vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    await useTasksStore.getState().toggleDone("d5");
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")!.status).toBe("done");
  });

  it("addTodayTask adds a task scheduled for store.today", async () => {
    vi.spyOn(api, "postTodo").mockResolvedValue({
      id: "srv-1",
      title: "臨時一件",
      status: "open",
      created_at: "x",
      updated_at: "x",
      custom_fields: { scheduled_dates: [MOCK_TODAY], is_adhoc: "true" },
    });
    await useTasksStore.getState().addTodayTask("臨時一件", useTasksStore.getState().today, true);
    const added = useTasksStore.getState().tasks.find((t) => t.id === "srv-1");
    expect(added?.custom_fields.scheduled_dates).toEqual([MOCK_TODAY]);
    expect(added?.custom_fields.is_adhoc).toBe("true");
  });

  it("acting during the create window defers the patch to the real id (no temp-id 404, optimistic kept)", async () => {
    let resolveCreate!: (t: Task) => void;
    vi.spyOn(api, "postTodo").mockReturnValue(
      new Promise<Task>((r) => {
        resolveCreate = r;
      }),
    );
    const patchSpy = vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);

    const today = useTasksStore.getState().today;
    // Fire the add but do NOT await: the POST is still in flight.
    const adding = useTasksStore.getState().addTodayTask("視窗內動作", today, true);

    // The optimistic task is on-screen with a temp id.
    const temp = useTasksStore.getState().tasks.find((t) => t.title === "視窗內動作")!;
    expect(temp.id).toMatch(/^temp-/);

    // User acts during the window. The temp-id patch is deferred (coalesced onto
    // the pending create), so no PATCH may target a temp id — that would 404 at
    // WSPC. (A real collider evicted by the new rank may legitimately be patched.)
    const acting = useTasksStore.getState().setDailyPriority(temp.id, "1", today);
    expect(patchSpy.mock.calls.every((c) => !String(c[0]).startsWith("temp-"))).toBe(true);

    // Create resolves to a real id.
    resolveCreate({
      id: "srv-win",
      title: "視窗內動作",
      status: "open",
      created_at: "x",
      updated_at: "x",
      custom_fields: { scheduled_dates: [today], is_adhoc: "true" },
    });
    await Promise.all([adding, acting]);

    // Reconcile kept the window's optimistic rank and adopted the real id.
    const reconciled = useTasksStore.getState().tasks.find((t) => t.id === "srv-win")!;
    expect(reconciled).toBeDefined();
    expect(dailyRankOn(reconciled, today)).toBe("1");
    expect(useTasksStore.getState().tasks.some((t) => t.id === temp.id)).toBe(false);

    // The deferred window patch flushed exactly once, against the reconciled real id.
    expect(patchSpy.mock.calls.filter((c) => c[0] === "srv-win")).toHaveLength(1);
  });

  it("setDailyPriority scopes eviction to the passed date", async () => {
    vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    await useTasksStore.getState().setDailyPriority("d5", "1", useTasksStore.getState().today);
    const s = useTasksStore.getState();
    const today = useTasksStore.getState().today;
    expect(dailyRankOn(s.tasks.find((t) => t.id === "d5")!, today)).toBe("1");
    expect(dailyRankOn(s.tasks.find((t) => t.id === "d1")!, today)).toBeNull();
  });

  it("deleteTask removes the task optimistically and sets recentlyDeleted", async () => {
    vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    const before = useTasksStore.getState().tasks.length;
    await useTasksStore.getState().deleteTask("d6");
    expect(useTasksStore.getState().tasks).toHaveLength(before - 1);
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d6")).toBeUndefined();
    const rd = useTasksStore.getState().recentlyDeleted;
    expect(rd).not.toBeNull();
    expect(rd!.task.id).toBe("d6");
  });

  it("deleteTask failure clears recentlyDeleted, sets error, and rolls back", async () => {
    vi.spyOn(api, "patchTodoApi").mockRejectedValue(new Error("boom"));
    const before = useTasksStore.getState().tasks.length;
    await useTasksStore.getState().deleteTask("d6");
    expect(useTasksStore.getState().tasks).toHaveLength(before);
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d6")).toBeDefined();
    expect(useTasksStore.getState().recentlyDeleted).toBeNull();
    expect(useTasksStore.getState().error).toBe("save_failed");
  });

  it("clearRecentlyDeleted clears recentlyDeleted", () => {
    useTasksStore.setState({
      recentlyDeleted: { task: allTasks[0], index: 0 },
    });
    useTasksStore.getState().clearRecentlyDeleted();
    expect(useTasksStore.getState().recentlyDeleted).toBeNull();
  });

  it("clearError clears error", () => {
    useTasksStore.setState({ error: "save_failed" });
    useTasksStore.getState().clearError();
    expect(useTasksStore.getState().error).toBeNull();
  });

  it("clearTasks clears recentlyDeleted too", () => {
    useTasksStore.setState({
      recentlyDeleted: { task: allTasks[0], index: 0 },
    });
    useTasksStore.getState().clearTasks();
    expect(useTasksStore.getState().recentlyDeleted).toBeNull();
    expect(useTasksStore.getState().tasks).toHaveLength(0);
  });
});

describe("server-backed tasks store", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetTodoQueue();
    useTasksStore.setState({ tasks: [], status: "idle", error: null, recentlyDeleted: null });
  });

  it("loadTasks populates from api (load-once)", async () => {
    useTasksStore.setState({ tasks: [], status: "idle" });
    vi.spyOn(api, "fetchTodos").mockResolvedValue([
      { id: "tod_1", title: "A", status: "open",
        created_at: "x", updated_at: "x", custom_fields: { scheduled_months: ["2026-05"] } },
    ]);
    await useTasksStore.getState().loadTasks();
    expect(useTasksStore.getState().tasks.map((t) => t.id)).toEqual(["tod_1"]);
    expect(useTasksStore.getState().status).toBe("ready");
  });

  it("loadTasks is a no-op when already ready", async () => {
    useTasksStore.setState({ tasks: [], status: "ready" });
    const spy = vi.spyOn(api, "fetchTodos");
    await useTasksStore.getState().loadTasks();
    expect(spy).not.toHaveBeenCalled();
  });

  it("sets status=error when load fails", async () => {
    useTasksStore.setState({ tasks: [], status: "idle" });
    vi.spyOn(api, "fetchTodos").mockRejectedValue(new Error("boom"));
    await useTasksStore.getState().loadTasks();
    expect(useTasksStore.getState().status).toBe("error");
  });

  it("ignores a stale load that resolves after a newer one", async () => {
    let resolveOld!: (v: import("@/lib/types").Task[]) => void;
    let resolveNew!: (v: import("@/lib/types").Task[]) => void;
    const oldP = new Promise<import("@/lib/types").Task[]>((r) => { resolveOld = r; });
    const newP = new Promise<import("@/lib/types").Task[]>((r) => { resolveNew = r; });
    const spy = vi.spyOn(api, "fetchTodos");
    spy.mockReturnValueOnce(oldP).mockReturnValueOnce(newP);

    const p1 = useTasksStore.getState().reload();
    const p2 = useTasksStore.getState().reload();

    // newer (second) call resolves first, older resolves last
    resolveNew([{ id: "new", title: "N", status: "open",
      created_at: "x", updated_at: "x", custom_fields: {} }]);
    resolveOld([{ id: "old", title: "O", status: "open",
      created_at: "x", updated_at: "x", custom_fields: {} }]);
    await Promise.all([p1, p2]);

    // the LAST reload's result ("new") must win, not the last-to-resolve ("old")
    expect(useTasksStore.getState().tasks.map((t) => t.id)).toEqual(["new"]);
    expect(useTasksStore.getState().today).toBe(todayISO());
    expect(useTasksStore.getState().status).toBe("ready");
  });

  it("rolls back toggleDone when patch fails", async () => {
    useTasksStore.setState({
      tasks: [{ id: "tod_1", title: "A", status: "open",
        created_at: "x", updated_at: "x", custom_fields: { scheduled_dates: ["2026-05-31"] } }],
    });
    vi.spyOn(api, "patchTodoApi").mockRejectedValue(new Error("boom"));
    await useTasksStore.getState().toggleDone("tod_1");
    expect(useTasksStore.getState().tasks[0].status).toBe("open"); // rolled back
    expect(useTasksStore.getState().error).not.toBeNull();
  });

  it("editTitle optimistically renames and persists", async () => {
    useTasksStore.setState({ tasks: [{ id: "t1", title: "Old", status: "open",
      created_at: "x", updated_at: "x", custom_fields: {} }] });
    const spy = vi.spyOn(api, "patchTodoApi").mockResolvedValue({ id: "t1" } as never);
    await useTasksStore.getState().editTitle("t1", "New");
    expect(useTasksStore.getState().tasks[0].title).toBe("New");
    expect(spy).toHaveBeenCalledWith("t1", { title: "New" });
  });

  it("editTitle rolls back when patch fails", async () => {
    useTasksStore.setState({ tasks: [{ id: "t1", title: "Old", status: "open",
      created_at: "x", updated_at: "x", custom_fields: {} }] });
    vi.spyOn(api, "patchTodoApi").mockRejectedValue(new Error("boom"));
    await useTasksStore.getState().editTitle("t1", "New");
    expect(useTasksStore.getState().tasks[0].title).toBe("Old"); // rolled back
    expect(useTasksStore.getState().error).not.toBeNull();
  });

  it("restoreTask re-inserts the task and patches with original status", async () => {
    const task = { id: "r1", title: "Restore me", status: "open" as const,
      created_at: "x", updated_at: "x", custom_fields: {} };
    useTasksStore.setState({
      tasks: [],
      recentlyDeleted: { task, index: 0 },
    });
    const spy = vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    await useTasksStore.getState().restoreTask();
    expect(useTasksStore.getState().tasks.find((t) => t.id === "r1")).toBeDefined();
    expect(useTasksStore.getState().recentlyDeleted).toBeNull();
    expect(spy).toHaveBeenCalledWith("r1", { status: "open" });
  });

  it("restoreTask rolls back and sets error when patch fails", async () => {
    const task = { id: "r1", title: "Restore me", status: "open" as const,
      created_at: "x", updated_at: "x", custom_fields: {} };
    useTasksStore.setState({
      tasks: [],
      recentlyDeleted: { task, index: 0 },
    });
    vi.spyOn(api, "patchTodoApi").mockRejectedValue(new Error("boom"));
    await useTasksStore.getState().restoreTask();
    expect(useTasksStore.getState().tasks).toHaveLength(0); // rolled back
    expect(useTasksStore.getState().error).toBe("save_failed");
    expect(useTasksStore.getState().recentlyDeleted).not.toBeNull(); // undo remains retryable
  });

  it("setAdhoc optimistically toggles and patches via queue", async () => {
    vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, status: "ready", error: null });
    await useTasksStore.getState().setAdhoc("d6", false);
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d6")!.custom_fields.is_adhoc,
    ).toBe("false");
  });

  it("setAdhoc rolls back on failure", async () => {
    vi.spyOn(api, "patchTodoApi").mockRejectedValue(new Error("boom"));
    const before = allTasks.find((t) => t.id === "d5")!.custom_fields.is_adhoc;
    useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, status: "ready", error: null });
    await useTasksStore.getState().setAdhoc("d5", true);
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.is_adhoc,
    ).toBe(before);
    expect(useTasksStore.getState().error).toBe("save_failed");
  });

  it("clearTasks resets status to idle so the next login re-fetches", async () => {
    useTasksStore.setState({ tasks: [{ id: "x", title: "X", status: "open",
      created_at: "x", updated_at: "x", custom_fields: {} }], status: "ready" });
    useTasksStore.getState().clearTasks();
    expect(useTasksStore.getState().status).toBe("idle");
    const spy = vi.spyOn(api, "fetchTodos").mockResolvedValue([]);
    await useTasksStore.getState().loadTasks();
    expect(spy).toHaveBeenCalled(); // load-once guard no longer blocks after clear
  });

  it("setMonthlyPriority sets and evicts within month, patching both", async () => {
    useTasksStore.setState({
      tasks: [
        { id: "a", title: "A", status: "open", created_at: "x", updated_at: "x",
          custom_fields: { scheduled_months: ["2026-05"], monthly_priority: "1" } },
        { id: "b", title: "B", status: "open", created_at: "x", updated_at: "x",
          custom_fields: { scheduled_months: ["2026-05"] } },
      ],
      status: "ready", error: null,
    });
    vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    await useTasksStore.getState().setMonthlyPriority("b", "1", "2026-05");
    const s = useTasksStore.getState();
    expect(monthlyRankOn(s.tasks.find((t) => t.id === "b")!, "2026-05")).toBe("1");
    expect(monthlyRankOn(s.tasks.find((t) => t.id === "a")!, "2026-05")).toBeNull();
  });

  it("addMonthTask adds a month-scoped task", async () => {
    useTasksStore.setState({ tasks: [], status: "ready", error: null });
    vi.spyOn(api, "postTodo").mockResolvedValue({
      id: "srv-m", title: "計畫", status: "open",
      created_at: "x", updated_at: "x",
      custom_fields: { scheduled_months: ["2026-05"], is_adhoc: "false" },
    });
    await useTasksStore.getState().addMonthTask("計畫", "2026-05", false);
    const added = useTasksStore.getState().tasks.find((t) => t.id === "srv-m");
    expect(added?.custom_fields.scheduled_months).toEqual(["2026-05"]);
  });

  it("addMonthTask marks the task adhoc when requested", async () => {
    useTasksStore.setState({ tasks: [], status: "ready", error: null });
    vi.spyOn(api, "postTodo").mockResolvedValue({
      id: "srv-ma",
      title: "月中臨時",
      status: "open",
      created_at: "x",
      updated_at: "x",
      custom_fields: { scheduled_months: ["2026-05"], is_adhoc: "true" },
    });
    await useTasksStore.getState().addMonthTask("月中臨時", "2026-05", true);
    const added = useTasksStore.getState().tasks.find((t) => t.id === "srv-ma");
    expect(added?.custom_fields.is_adhoc).toBe("true");
  });

  it("addTodayTask marks the task planned when requested", async () => {
    useTasksStore.setState({ tasks: [], status: "ready", error: null, today: MOCK_TODAY });
    vi.spyOn(api, "postTodo").mockResolvedValue({
      id: "srv-tp",
      title: "計畫的事",
      status: "open",
      created_at: "x",
      updated_at: "x",
      custom_fields: { scheduled_dates: [MOCK_TODAY], is_adhoc: "false" },
    });
    await useTasksStore.getState().addTodayTask("計畫的事", MOCK_TODAY, false);
    const added = useTasksStore.getState().tasks.find((t) => t.id === "srv-tp");
    expect(added?.custom_fields.is_adhoc).toBe("false");
  });

  it("setDailyPriority reloads from server when a patch fails", async () => {
    useTasksStore.setState({
      tasks: allTasks,
      today: MOCK_TODAY,
      status: "ready",
      error: null,
      recentlyDeleted: null,
    });
    vi.spyOn(api, "patchTodoApi").mockRejectedValue(new Error("boom"));
    const reload = vi.spyOn(api, "fetchTodos").mockResolvedValue([
      {
        id: "reloaded",
        title: "R",
        status: "open",
        created_at: "x",
        updated_at: "x",
        custom_fields: {},
      },
    ]);
    await useTasksStore.getState().setDailyPriority("d5", "1", useTasksStore.getState().today);
    expect(reload).toHaveBeenCalled();
    expect(useTasksStore.getState().tasks.map((t) => t.id)).toEqual(["reloaded"]);
  });
});

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

  it("rolls back the optimistic task and sets error when postTodo fails", async () => {
    vi.spyOn(api, "postTodo").mockRejectedValue(new Error("x"));
    useTasksStore.setState({ tasks: [], status: "ready", error: null });
    await useTasksStore.getState().addBacklogTask("foo");
    expect(useTasksStore.getState().tasks).toHaveLength(0);
    expect(useTasksStore.getState().error).toBe("save_failed");
  });
});

describe("promoteToMonth rollback", () => {
  it("rolls back scheduled_months and sets error when patch fails", async () => {
    vi.spyOn(api, "patchTodoApi").mockRejectedValue(new Error("x"));
    useTasksStore.setState({
      tasks: [{
        id: "a", title: "t", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: [] },
      }],
      status: "ready", error: null,
    });
    await useTasksStore.getState().promoteToMonth("a", "2026-06");
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "a")!.custom_fields.scheduled_months,
    ).toEqual([]);
    expect(useTasksStore.getState().error).toBe("save_failed");
  });
});

describe("planScheduleDay rollback", () => {
  it("rolls back scheduled_dates and scheduled_months and sets error when patch fails", async () => {
    vi.spyOn(api, "patchTodoApi").mockRejectedValue(new Error("x"));
    useTasksStore.setState({
      tasks: [{
        id: "a", title: "t", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_dates: [], scheduled_months: [] },
      }],
      status: "ready", error: null,
    });
    await useTasksStore.getState().planScheduleDay("a", "2026-06-08");
    const task = useTasksStore.getState().tasks.find((t) => t.id === "a")!;
    expect(task.custom_fields.scheduled_dates).toEqual([]);
    expect(task.custom_fields.scheduled_months).toEqual([]);
    expect(useTasksStore.getState().error).toBe("save_failed");
  });
});

function task(id: string, over: Partial<Task> = {}): Task {
  return { id, title: id, status: "open", created_at: "", updated_at: "", custom_fields: {}, ...over };
}

describe("editDescription", () => {
  it("optimistically sets description and patches", async () => {
    const spy = vi.spyOn(queue, "enqueuePatch").mockResolvedValue(task("t1"));
    useTasksStore.setState({ tasks: [task("t1")] });
    await useTasksStore.getState().editDescription("t1", "**hi**");
    expect(useTasksStore.getState().tasks[0].description).toBe("**hi**");
    expect(spy.mock.calls[0]).toEqual(["t1", { description: "**hi**" }]);
  });

  it("rolls back on failure", async () => {
    vi.spyOn(queue, "enqueuePatch").mockRejectedValue(new Error("x"));
    useTasksStore.setState({ tasks: [task("t1", { description: "old" })] });
    await useTasksStore.getState().editDescription("t1", "new");
    expect(useTasksStore.getState().tasks[0].description).toBe("old");
    expect(useTasksStore.getState().error).toBe("save_failed");
  });
});

describe("bumpSubtaskCount", () => {
  it("adjusts subtask_count by delta, floored at 0", () => {
    useTasksStore.setState({ tasks: [task("t1", { subtask_count: 1 })] });
    useTasksStore.getState().bumpSubtaskCount("t1", 1);
    expect(useTasksStore.getState().tasks[0].subtask_count).toBe(2);
    useTasksStore.getState().bumpSubtaskCount("t1", -5);
    expect(useTasksStore.getState().tasks[0].subtask_count).toBe(0);
  });

  it("adjusts subtask_done by doneDelta, floored at 0", () => {
    useTasksStore.setState({ tasks: [task("t1", { subtask_count: 3, subtask_done: 1 })] });
    useTasksStore.getState().bumpSubtaskCount("t1", 0, 1);
    expect(useTasksStore.getState().tasks[0].subtask_done).toBe(2);
    useTasksStore.getState().bumpSubtaskCount("t1", 0, -5);
    expect(useTasksStore.getState().tasks[0].subtask_done).toBe(0);
  });
});

describe("moveToNextMonth action", () => {
  it("optimistically appends next month and clears monthly_priority", async () => {
    const spy = vi.spyOn(queue, "enqueuePatch").mockResolvedValue({} as never);
    useTasksStore.setState({
      tasks: [{
        id: "m1", title: "月任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2026-05"], monthly_priority: "1" },
      }],
      status: "ready", error: null,
    });
    await useTasksStore.getState().moveToNextMonth("m1");
    const t = useTasksStore.getState().tasks.find((x) => x.id === "m1")!;
    expect(t.custom_fields.scheduled_months).toEqual(["2026-05", "2026-06"]);
    expect(t.custom_fields.monthly_priority).toBeUndefined();
    expect(spy).toHaveBeenCalledWith("m1", {
      scheduled_months: ["2026-05", "2026-06"],
      monthly_priority: null,
    });
  });

  it("rolls back and sets error when enqueuePatch rejects", async () => {
    vi.spyOn(queue, "enqueuePatch").mockRejectedValue(new Error("boom"));
    useTasksStore.setState({
      tasks: [{
        id: "m1", title: "月任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2026-05"], monthly_priority: "2" },
      }],
      status: "ready", error: null,
    });
    await useTasksStore.getState().moveToNextMonth("m1");
    const t = useTasksStore.getState().tasks.find((x) => x.id === "m1")!;
    expect(t.custom_fields.scheduled_months).toEqual(["2026-05"]);
    expect(t.custom_fields.monthly_priority).toBe("2");
    expect(useTasksStore.getState().error).toBe("save_failed");
  });
});

describe("demoteToBacklog action", () => {
  it("optimistically sets unscheduled_month/unscheduled_at and clears priorities", async () => {
    const spy = vi.spyOn(queue, "enqueuePatch").mockResolvedValue({} as never);
    useTasksStore.setState({
      tasks: [{
        id: "m2", title: "月任務退回", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2026-06"], monthly_priority: "1", daily_priority: "2" },
      }],
      today: "2026-06-14",
      status: "ready", error: null,
    });
    await useTasksStore.getState().demoteToBacklog("m2");
    const t = useTasksStore.getState().tasks.find((x) => x.id === "m2")!;
    expect(t.custom_fields.unscheduled_month).toBe("2026-06");
    expect(t.custom_fields.unscheduled_at).toBe("2026-06-14");
    expect(t.custom_fields.monthly_priority).toBeUndefined();
    expect(t.custom_fields.daily_priority).toBeUndefined();
    expect(spy).toHaveBeenCalledWith("m2", {
      unscheduled_month: "2026-06",
      unscheduled_at: "2026-06-14",
      monthly_priority: null,
      daily_priority: null,
    });
  });

  it("rolls back and sets error when enqueuePatch rejects", async () => {
    vi.spyOn(queue, "enqueuePatch").mockRejectedValue(new Error("boom"));
    useTasksStore.setState({
      tasks: [{
        id: "m2", title: "月任務退回", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2026-06"], monthly_priority: "3" },
      }],
      today: "2026-06-14",
      status: "ready", error: null,
    });
    await useTasksStore.getState().demoteToBacklog("m2");
    const t = useTasksStore.getState().tasks.find((x) => x.id === "m2")!;
    expect(t.custom_fields.scheduled_months).toEqual(["2026-06"]);
    expect(t.custom_fields.unscheduled_month).toBeUndefined();
    expect(t.custom_fields.monthly_priority).toBe("3");
    expect(useTasksStore.getState().error).toBe("save_failed");
  });
});

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

describe("persist + synced (SWR)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    useTasksStore.setState({ tasks: [], status: "idle", error: null, synced: true });
  });

  it("persists only tasks, not status", () => {
    useTasksStore.setState({
      tasks: [{ id: "p1", title: "P", status: "open", created_at: "x", updated_at: "x", custom_fields: {} }],
      status: "ready",
    });
    const stored = JSON.parse(localStorage.getItem("desk-tasks")!);
    expect(stored.state.tasks.map((t: { id: string }) => t.id)).toEqual(["p1"]);
    expect(stored.state.status).toBeUndefined();
  });

  it("sets synced=true after a successful reload", async () => {
    useTasksStore.setState({ synced: false });
    vi.spyOn(api, "fetchTodos").mockResolvedValue([
      { id: "r", title: "R", status: "open", created_at: "x", updated_at: "x", custom_fields: {} },
    ]);
    await useTasksStore.getState().reload();
    expect(useTasksStore.getState().synced).toBe(true);
  });

  it("keeps cached tasks and flags unsynced when reload fails with cache", async () => {
    useTasksStore.setState({
      tasks: [{ id: "cached", title: "C", status: "open", created_at: "x", updated_at: "x", custom_fields: {} }],
      status: "ready",
      synced: true,
    });
    vi.spyOn(api, "fetchTodos").mockRejectedValue(new Error("boom"));
    await useTasksStore.getState().reload();
    const s = useTasksStore.getState();
    expect(s.tasks.map((t) => t.id)).toEqual(["cached"]);
    expect(s.status).toBe("ready");
    expect(s.synced).toBe(false);
  });

  it("falls back to status=error when reload fails with no cache", async () => {
    useTasksStore.setState({ tasks: [], status: "idle", synced: true });
    vi.spyOn(api, "fetchTodos").mockRejectedValue(new Error("boom"));
    await useTasksStore.getState().reload();
    expect(useTasksStore.getState().status).toBe("error");
  });

  it("a successful write clears a stale unsynced flag", async () => {
    useTasksStore.setState({
      tasks: [{ id: "t1", title: "A", status: "open", created_at: "x", updated_at: "x", custom_fields: {} }],
      status: "ready",
      synced: false,
    });
    vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    await useTasksStore.getState().toggleDone("t1");
    expect(useTasksStore.getState().synced).toBe(true);
  });

  it("a failed write does not set synced true", async () => {
    useTasksStore.setState({
      tasks: [{ id: "t1", title: "A", status: "open", created_at: "x", updated_at: "x", custom_fields: {} }],
      status: "ready",
      synced: false,
    });
    vi.spyOn(api, "patchTodoApi").mockRejectedValue(new Error("boom"));
    await useTasksStore.getState().toggleDone("t1");
    expect(useTasksStore.getState().synced).toBe(false);
  });
});
