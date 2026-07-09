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

  it("reorders subtasks and backfills positions via the patch queue", async () => {
    // None of the seeded subtasks has a position yet — moving c3 to the front
    // must both reorder locally and assign sortable positions so the server's
    // position-first sort reproduces the new order on the next load.
    vi.spyOn(api, "fetchSubtasks").mockResolvedValue([
      { id: "c1", title: "a", status: "open" },
      { id: "c2", title: "b", status: "open" },
      { id: "c3", title: "c", status: "open" },
    ]);
    const spy = vi.spyOn(queue, "enqueuePatch").mockResolvedValue({} as never);
    const { result } = renderHook(() => useTaskDetail("t1"));
    await waitFor(() => expect(result.current.subtasks).toHaveLength(3));
    await act(async () => { await result.current.reorder("c3", "c1"); });
    expect(result.current.subtasks.map((s) => s.id)).toEqual(["c3", "c1", "c2"]);
    // Every subtask got a position patch, and the assigned keys sort in order.
    const patched = new Map(spy.mock.calls.map(([id, patch]) => [id, (patch as { position: string }).position]));
    const positions = ["c3", "c1", "c2"].map((id) => patched.get(id)!);
    expect(positions.every(Boolean)).toBe(true);
    expect([...positions].sort()).toEqual(positions);
  });

  it("only patches subtasks whose position actually changes", async () => {
    vi.spyOn(api, "fetchSubtasks").mockResolvedValue([
      { id: "c1", title: "a", status: "open", position: "b" },
      { id: "c2", title: "b", status: "open", position: "m" },
      { id: "c3", title: "c", status: "open", position: "t" },
    ]);
    const spy = vi.spyOn(queue, "enqueuePatch").mockResolvedValue({} as never);
    const { result } = renderHook(() => useTaskDetail("t1"));
    await waitFor(() => expect(result.current.subtasks).toHaveLength(3));
    await act(async () => { await result.current.reorder("c3", "c2"); });
    expect(result.current.subtasks.map((s) => s.id)).toEqual(["c1", "c3", "c2"]);
    expect(spy).toHaveBeenCalledTimes(1);
    const [id, patch] = spy.mock.calls[0];
    expect(id).toBe("c3");
    const pos = (patch as { position: string }).position;
    expect(pos > "b" && pos < "m").toBe(true);
  });

  it("rolls back the order when the reorder patch fails", async () => {
    vi.spyOn(api, "fetchSubtasks").mockResolvedValue([
      { id: "c1", title: "a", status: "open", position: "b" },
      { id: "c2", title: "b", status: "open", position: "m" },
    ]);
    vi.spyOn(queue, "enqueuePatch").mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useTaskDetail("t1"));
    await waitFor(() => expect(result.current.subtasks).toHaveLength(2));
    await act(async () => { await result.current.reorder("c2", "c1"); });
    expect(result.current.subtasks.map((s) => s.id)).toEqual(["c1", "c2"]);
  });

  it("renames a subtask via the patch queue", async () => {
    vi.spyOn(api, "fetchSubtasks").mockResolvedValue([{ id: "c1", title: "s", status: "open" }]);
    const spy = vi.spyOn(queue, "enqueuePatch").mockResolvedValue({} as never);
    const { result } = renderHook(() => useTaskDetail("t1"));
    await waitFor(() => expect(result.current.subtasks).toHaveLength(1));
    await act(async () => { await result.current.rename("c1", "renamed"); });
    expect(result.current.subtasks[0].title).toBe("renamed");
    expect(spy.mock.calls[0]).toEqual(["c1", { title: "renamed" }]);
  });
});
