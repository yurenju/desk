import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import * as api from "@/lib/api/todo";
import * as queue from "@/lib/api/todoQueue";
import { useTasksStore } from "@/store/tasks";
import { useTaskDetail } from "./useTaskDetail";

beforeEach(() => {
  vi.restoreAllMocks();
  useTasksStore.setState({
    tasks: [{ id: "t1", title: "T", status: "open", created_at: "", updated_at: "",
      custom_fields: {}, subtask_count: 1 }],
    status: "ready", error: null, recentlyDeleted: null,
  });
});

describe("useTaskDetail", () => {
  it("loads subtasks for the given parent", async () => {
    vi.spyOn(api, "fetchSubtasks").mockResolvedValue([{ id: "c1", title: "s", status: "open" }]);
    const { result } = renderHook(() => useTaskDetail("t1"));
    await waitFor(() => expect(result.current.subtasks).toHaveLength(1));
    expect(result.current.status).toBe("ready");
  });

  it("adds a subtask and bumps parent count", async () => {
    vi.spyOn(api, "fetchSubtasks").mockResolvedValue([]);
    vi.spyOn(api, "createSubtask").mockResolvedValue({ id: "c9", title: "new", status: "open" });
    const { result } = renderHook(() => useTaskDetail("t1"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(async () => { await result.current.add("new"); });
    expect(result.current.subtasks.map((s) => s.id)).toContain("c9");
    expect(useTasksStore.getState().tasks[0].subtask_count).toBe(2);
  });

  it("toggles a subtask via the patch queue", async () => {
    vi.spyOn(api, "fetchSubtasks").mockResolvedValue([{ id: "c1", title: "s", status: "open" }]);
    const spy = vi.spyOn(queue, "enqueuePatch").mockResolvedValue({} as never);
    const { result } = renderHook(() => useTaskDetail("t1"));
    await waitFor(() => expect(result.current.subtasks).toHaveLength(1));
    await act(async () => { await result.current.toggle("c1"); });
    expect(result.current.subtasks[0].status).toBe("done");
    expect(spy.mock.calls[0]).toEqual(["c1", { status: "done" }]);
  });

  it("removes a subtask and decrements parent count", async () => {
    vi.spyOn(api, "fetchSubtasks").mockResolvedValue([{ id: "c1", title: "s", status: "open" }]);
    vi.spyOn(queue, "enqueuePatch").mockResolvedValue({} as never);
    const { result } = renderHook(() => useTaskDetail("t1"));
    await waitFor(() => expect(result.current.subtasks).toHaveLength(1));
    await act(async () => { await result.current.remove("c1"); });
    expect(result.current.subtasks).toHaveLength(0);
    expect(useTasksStore.getState().tasks[0].subtask_count).toBe(0);
  });
});
