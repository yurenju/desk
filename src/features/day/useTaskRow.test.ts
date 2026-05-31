import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTaskRow } from "./useTaskRow";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";
import * as api from "@/lib/api/todo";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  vi.spyOn(api, "postTodo").mockResolvedValue({} as never);
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, status: "ready", error: null });
});

describe("useTaskRow", () => {
  it("cyclePriority fills the next free slot for an unprioritized task", async () => {
    // free up all three slots, then promoting an unprioritized task takes slot 1
    await act(async () => {
      const s = useTasksStore.getState();
      await s.setDailyPriority("d1", null);
      await s.setDailyPriority("d2", null);
      await s.setDailyPriority("d3", null);
    });
    const { result } = renderHook(() => useTaskRow("d5")); // d5 has no daily_priority
    await act(async () => result.current.cyclePriority());
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority,
    ).toBe("1");
  });

  it("cyclePriority does not evict existing top-3 tasks when promoting", async () => {
    // d1=1, d2=2, d3=3 occupy slots; clearing d2 leaves slot 2 free
    await act(async () => {
      const s = useTasksStore.getState();
      await s.setDailyPriority("d1", "1");
      await s.setDailyPriority("d2", "2");
      await s.setDailyPriority("d3", "3");
      await s.setDailyPriority("d2", null);
    });
    const { result } = renderHook(() => useTaskRow("d5"));
    await act(async () => result.current.cyclePriority());
    const tasks = useTasksStore.getState().tasks;
    expect(tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority).toBe("2");
    // d1 / d3 stay put — no eviction
    expect(tasks.find((t) => t.id === "d1")!.custom_fields.daily_priority).toBe("1");
    expect(tasks.find((t) => t.id === "d3")!.custom_fields.daily_priority).toBe("3");
  });

  it("cyclePriority does nothing when all three slots are full", async () => {
    await act(async () => {
      const s = useTasksStore.getState();
      await s.setDailyPriority("d1", "1");
      await s.setDailyPriority("d2", "2");
      await s.setDailyPriority("d3", "3");
    });
    const { result } = renderHook(() => useTaskRow("d5"));
    await act(async () => result.current.cyclePriority());
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority,
    ).toBeUndefined();
  });

  it("cyclePriority cycles the number for a task already in the top three", async () => {
    await act(async () => useTasksStore.getState().setDailyPriority("d1", "1"));
    const { result } = renderHook(() => useTaskRow("d1")); // already prioritized
    await act(async () => result.current.cyclePriority());
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d1")!.custom_fields.daily_priority,
    ).toBe("2");
  });

  it("startEdit / commitEdit writes the draft via the store", async () => {
    const { result } = renderHook(() => useTaskRow("d5"));
    act(() => result.current.startEdit("讀文件"));
    expect(result.current.isEditing).toBe(true);
    act(() => result.current.changeDraft("讀完文件"));
    await act(async () => result.current.commitEdit());
    expect(result.current.isEditing).toBe(false);
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")!.title).toBe("讀完文件");
  });

  it("cancelEdit leaves the title untouched", () => {
    const { result } = renderHook(() => useTaskRow("d5"));
    act(() => result.current.startEdit("讀文件"));
    act(() => result.current.changeDraft("亂改"));
    act(() => result.current.cancelEdit());
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")!.title).toBe(
      "讀 WSPC custom fields 文件",
    );
  });
});
