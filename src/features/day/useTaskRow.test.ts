import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTaskRow } from "./useTaskRow";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";
import * as api from "@/lib/api/todo";
import { resetTodoQueue } from "@/lib/api/todoQueue";

beforeEach(() => {
  vi.restoreAllMocks();
  resetTodoQueue();
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  vi.spyOn(api, "postTodo").mockResolvedValue({} as never);
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, status: "ready", error: null });
});

describe("useTaskRow", () => {
  it("setPriority sets the chosen slot", async () => {
    await act(async () => {
      const s = useTasksStore.getState();
      await s.setDailyPriority("d1", null);
      await s.setDailyPriority("d2", null);
      await s.setDailyPriority("d3", null);
    });
    const { result } = renderHook(() => useTaskRow("d5"));
    await act(async () => result.current.setPriority("1"));
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority,
    ).toBe("1");
  });

  it("setPriority evicts the previous occupant of the chosen slot", async () => {
    await act(async () => {
      const s = useTasksStore.getState();
      await s.setDailyPriority("d1", "1");
    });
    const { result } = renderHook(() => useTaskRow("d5"));
    await act(async () => result.current.setPriority("1"));
    const tasks = useTasksStore.getState().tasks;
    expect(tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority).toBe("1");
    expect(tasks.find((t) => t.id === "d1")!.custom_fields.daily_priority).toBeUndefined();
  });

  it("setPriority(null) removes the priority", async () => {
    await act(async () => useTasksStore.getState().setDailyPriority("d1", "1"));
    const { result } = renderHook(() => useTaskRow("d1"));
    await act(async () => result.current.setPriority(null));
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d1")!.custom_fields.daily_priority,
    ).toBeUndefined();
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
