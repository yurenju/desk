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
  it("cyclePriority fills the next free slot for an unprioritized task", () => {
    // free up all three slots, then promoting an unprioritized task takes slot 1
    act(() => {
      const s = useTasksStore.getState();
      s.setDailyPriority("d1", null);
      s.setDailyPriority("d2", null);
      s.setDailyPriority("d3", null);
    });
    const { result } = renderHook(() => useTaskRow("d5")); // d5 has no daily_priority
    act(() => result.current.cyclePriority());
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority,
    ).toBe("1");
  });

  it("cyclePriority does not evict existing top-3 tasks when promoting", () => {
    // d1=1, d2=2, d3=3 occupy slots; clearing d2 leaves slot 2 free
    act(() => {
      const s = useTasksStore.getState();
      s.setDailyPriority("d1", "1");
      s.setDailyPriority("d2", "2");
      s.setDailyPriority("d3", "3");
      s.setDailyPriority("d2", null);
    });
    const { result } = renderHook(() => useTaskRow("d5"));
    act(() => result.current.cyclePriority());
    const tasks = useTasksStore.getState().tasks;
    expect(tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority).toBe("2");
    // d1 / d3 stay put — no eviction
    expect(tasks.find((t) => t.id === "d1")!.custom_fields.daily_priority).toBe("1");
    expect(tasks.find((t) => t.id === "d3")!.custom_fields.daily_priority).toBe("3");
  });

  it("cyclePriority does nothing when all three slots are full", () => {
    act(() => {
      const s = useTasksStore.getState();
      s.setDailyPriority("d1", "1");
      s.setDailyPriority("d2", "2");
      s.setDailyPriority("d3", "3");
    });
    const { result } = renderHook(() => useTaskRow("d5"));
    act(() => result.current.cyclePriority());
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority,
    ).toBeUndefined();
  });

  it("cyclePriority cycles the number for a task already in the top three", () => {
    act(() => useTasksStore.getState().setDailyPriority("d1", "1"));
    const { result } = renderHook(() => useTaskRow("d1")); // already prioritized
    act(() => result.current.cyclePriority());
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d1")!.custom_fields.daily_priority,
    ).toBe("2");
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
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")!.title).toBe(
      "讀 WSPC custom fields 文件",
    );
  });
});
