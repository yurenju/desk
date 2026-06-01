import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTasksStore } from "./tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";
import * as api from "@/lib/api/todo";
import { resetTodoQueue } from "@/lib/api/todoQueue";

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
      parent_id: null,
      created_at: "x",
      updated_at: "x",
      custom_fields: { scheduled_dates: [MOCK_TODAY], is_adhoc: "true" },
    });
    await useTasksStore.getState().addTodayTask("臨時一件");
    const added = useTasksStore.getState().tasks.find((t) => t.id === "srv-1");
    expect(added?.custom_fields.scheduled_dates).toEqual([MOCK_TODAY]);
    expect(added?.custom_fields.is_adhoc).toBe("true");
  });

  it("setDailyPriority routes through store.today for eviction", async () => {
    vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    await useTasksStore.getState().setDailyPriority("d5", "1");
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
    useTasksStore.setState({ tasks: [], error: null, recentlyDeleted: null });
  });

  it("loadTasks populates from api", async () => {
    vi.spyOn(api, "fetchTodos").mockResolvedValue([
      { id: "tod_1", title: "A", status: "open", parent_id: null,
        created_at: "x", updated_at: "x", custom_fields: { scheduled_dates: ["2026-05-31"] } },
    ]);
    await useTasksStore.getState().loadTasks("2026-05-31");
    expect(useTasksStore.getState().tasks.map((t) => t.id)).toEqual(["tod_1"]);
    expect(useTasksStore.getState().status).toBe("ready");
  });

  it("sets status=error when load fails", async () => {
    vi.spyOn(api, "fetchTodos").mockRejectedValue(new Error("boom"));
    await useTasksStore.getState().loadTasks("2026-05-31");
    expect(useTasksStore.getState().status).toBe("error");
  });

  it("ignores a stale load that resolves after a newer one", async () => {
    let resolveOld!: (v: import("@/lib/types").Task[]) => void;
    let resolveNew!: (v: import("@/lib/types").Task[]) => void;
    const oldP = new Promise<import("@/lib/types").Task[]>((r) => { resolveOld = r; });
    const newP = new Promise<import("@/lib/types").Task[]>((r) => { resolveNew = r; });
    const spy = vi.spyOn(api, "fetchTodos");
    spy.mockReturnValueOnce(oldP).mockReturnValueOnce(newP);

    const p1 = useTasksStore.getState().loadTasks("2026-05-30");
    const p2 = useTasksStore.getState().loadTasks("2026-05-31");

    // newer (second) call resolves first, older resolves last
    resolveNew([{ id: "new", title: "N", status: "open", parent_id: null,
      created_at: "x", updated_at: "x", custom_fields: {} }]);
    resolveOld([{ id: "old", title: "O", status: "open", parent_id: null,
      created_at: "x", updated_at: "x", custom_fields: {} }]);
    await Promise.all([p1, p2]);

    // the LATEST requested date (05-31 / "new") must win, not the last-to-resolve
    expect(useTasksStore.getState().tasks.map((t) => t.id)).toEqual(["new"]);
    expect(useTasksStore.getState().today).toBe("2026-05-31");
    expect(useTasksStore.getState().status).toBe("ready");
  });

  it("rolls back toggleDone when patch fails", async () => {
    useTasksStore.setState({
      tasks: [{ id: "tod_1", title: "A", status: "open", parent_id: null,
        created_at: "x", updated_at: "x", custom_fields: { scheduled_dates: ["2026-05-31"] } }],
    });
    vi.spyOn(api, "patchTodoApi").mockRejectedValue(new Error("boom"));
    await useTasksStore.getState().toggleDone("tod_1");
    expect(useTasksStore.getState().tasks[0].status).toBe("open"); // rolled back
    expect(useTasksStore.getState().error).not.toBeNull();
  });

  it("editTitle optimistically renames and persists", async () => {
    useTasksStore.setState({ tasks: [{ id: "t1", title: "Old", status: "open", parent_id: null,
      created_at: "x", updated_at: "x", custom_fields: {} }] });
    const spy = vi.spyOn(api, "patchTodoApi").mockResolvedValue({ id: "t1" } as never);
    await useTasksStore.getState().editTitle("t1", "New");
    expect(useTasksStore.getState().tasks[0].title).toBe("New");
    expect(spy).toHaveBeenCalledWith("t1", { title: "New" });
  });

  it("editTitle rolls back when patch fails", async () => {
    useTasksStore.setState({ tasks: [{ id: "t1", title: "Old", status: "open", parent_id: null,
      created_at: "x", updated_at: "x", custom_fields: {} }] });
    vi.spyOn(api, "patchTodoApi").mockRejectedValue(new Error("boom"));
    await useTasksStore.getState().editTitle("t1", "New");
    expect(useTasksStore.getState().tasks[0].title).toBe("Old"); // rolled back
    expect(useTasksStore.getState().error).not.toBeNull();
  });

  it("restoreTask re-inserts the task and patches with original status", async () => {
    const task = { id: "r1", title: "Restore me", status: "open" as const, parent_id: null,
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
    const task = { id: "r1", title: "Restore me", status: "open" as const, parent_id: null,
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
        parent_id: null,
        created_at: "x",
        updated_at: "x",
        custom_fields: {},
      },
    ]);
    await useTasksStore.getState().setDailyPriority("d5", "1");
    expect(reload).toHaveBeenCalledWith(MOCK_TODAY);
    expect(useTasksStore.getState().tasks.map((t) => t.id)).toEqual(["reloaded"]);
  });
});
