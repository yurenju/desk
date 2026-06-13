import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTasksStore } from "./tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";
import * as api from "@/lib/api/todo";
import { resetTodoQueue } from "@/lib/api/todoQueue";
import * as queue from "@/lib/api/todoQueue";
import type { Task } from "@/lib/types";
import { todayISO } from "@/lib/date";

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

  it("setDailyPriority scopes eviction to the passed date", async () => {
    vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    await useTasksStore.getState().setDailyPriority("d5", "1", useTasksStore.getState().today);
    const s = useTasksStore.getState();
    expect(s.tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority).toBe("1");
    expect(s.tasks.find((t) => t.id === "d1")!.custom_fields.daily_priority).toBeUndefined();
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
    expect(s.tasks.find((t) => t.id === "b")!.custom_fields.monthly_priority).toBe("1");
    expect(s.tasks.find((t) => t.id === "a")!.custom_fields.monthly_priority).toBeUndefined();
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
