import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTasksStore } from "./tasks";
import * as api from "@/lib/api/todo";
import { resetTodoQueue } from "@/lib/api/todoQueue";
import type { Task } from "@/lib/types";

function seed(tasks: Task[], today = "2026-01-15") {
  useTasksStore.setState({
    tasks,
    today,
    status: "ready",
    error: null,
    recentlyDeleted: null,
    synced: true,
  });
}

function task(id: string, over: Partial<Task> = {}): Task {
  return {
    id,
    title: "t",
    status: "open",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    custom_fields: {},
    ...over,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  resetTodoQueue();
});

describe("apply lifecycle (single-id)", () => {
  it("optimistically sets state and PATCHes only the derived diff", async () => {
    const patchSpy = vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    seed([task("x", { custom_fields: { scheduled_months: ["2026-01"] } })]);

    await useTasksStore.getState().planScheduleDay("x", "2026-01-20");

    const t = useTasksStore.getState().tasks.find((t) => t.id === "x")!;
    expect(t.custom_fields.scheduled_dates).toEqual(["2026-01-20"]);
    // Month was already the primary month → not re-sent. Only the real change ships.
    expect(patchSpy).toHaveBeenCalledTimes(1);
    expect(patchSpy.mock.calls[0]).toEqual(["x", { scheduled_dates: ["2026-01-20"] }]);
  });

  it("rolls back to the previous tasks and flags save_failed on a single-id failure", async () => {
    vi.spyOn(api, "patchTodoApi").mockRejectedValue(new Error("boom"));
    const before = task("x", { custom_fields: { scheduled_months: ["2026-01"] } });
    seed([before]);

    await useTasksStore.getState().planScheduleDay("x", "2026-01-20");

    const t = useTasksStore.getState().tasks.find((t) => t.id === "x")!;
    expect(t.custom_fields.scheduled_dates).toBeUndefined();
    expect(useTasksStore.getState().error).toBe("save_failed");
  });

  it("reloads (not per-id rollback) when a multi-id change fails", async () => {
    vi.spyOn(api, "patchTodoApi").mockRejectedValue(new Error("boom"));
    const fetchSpy = vi.spyOn(api, "fetchTodos").mockResolvedValue([]);
    const today = "2026-01-15";
    // "b" already holds rank 1 today (legacy field); giving "a" rank 1 evicts it
    // → two tasks change → Promise.all failure must reload, not roll back one id.
    seed(
      [
        task("a", { custom_fields: { scheduled_dates: [today] } }),
        task("b", { custom_fields: { scheduled_dates: [today], daily_priority: "1" } }),
      ],
      today,
    );

    await useTasksStore.getState().setDailyPriority("a", "1", today);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("sends a minimal diff on the multi-id path (no redundant legacy null)", async () => {
    const patchSpy = vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    const today = "2026-01-15";
    // "a" never had a legacy daily_priority, so promoting it to rank 1 must not
    // ship a redundant `daily_priority: null` — only its changed daily_ranks.
    seed([task("a", { custom_fields: { scheduled_dates: [today] } })], today);

    await useTasksStore.getState().setDailyPriority("a", "1", today);

    const call = patchSpy.mock.calls.find((c) => c[0] === "a")!;
    expect(call).toBeDefined();
    expect(call[1]).not.toHaveProperty("daily_priority");
  });

  it("clears a description with an empty-string wire patch (not omitted)", async () => {
    const patchSpy = vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    seed([task("x", { description: "some notes" })]);

    await useTasksStore.getState().editDescription("x", "");

    expect(patchSpy).toHaveBeenCalledTimes(1);
    expect(patchSpy.mock.calls[0]).toEqual(["x", { description: "" }]);
  });

  it("no-op transform does not touch state or hit the network", async () => {
    const patchSpy = vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    // Already scheduled on this exact day → planScheduleDayOp returns prev unchanged.
    seed([
      task("x", {
        custom_fields: { scheduled_dates: ["2026-01-20"], scheduled_months: ["2026-01"] },
      }),
    ]);

    await useTasksStore.getState().planScheduleDay("x", "2026-01-20");

    expect(patchSpy).not.toHaveBeenCalled();
  });
});
