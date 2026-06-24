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
      const today = useTasksStore.getState().today;
      await s.setDailyPriority("d1", null, today);
      await s.setDailyPriority("d2", null, today);
      await s.setDailyPriority("d3", null, today);
    });
    const { result } = renderHook(() => useTaskRow("d5", useTasksStore.getState().today));
    await act(async () => result.current.setPriority("1"));
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority,
    ).toBe("1");
  });

  // reorderPriority cascades: d1 (was rank 1) is pushed to rank 2 when d5 takes rank 1.
  it("setPriority cascades the previous occupant of the chosen slot", async () => {
    await act(async () => {
      const s = useTasksStore.getState();
      await s.setDailyPriority("d1", "1", useTasksStore.getState().today);
    });
    const { result } = renderHook(() => useTaskRow("d5", useTasksStore.getState().today));
    await act(async () => result.current.setPriority("1"));
    const tasks = useTasksStore.getState().tasks;
    expect(tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority).toBe("1");
    // cascade: d1 is pushed down to rank 2, not evicted
    expect(tasks.find((t) => t.id === "d1")!.custom_fields.daily_priority).toBe("2");
  });

  it("setPriority(null) removes the priority", async () => {
    await act(async () =>
      useTasksStore.getState().setDailyPriority("d1", "1", useTasksStore.getState().today),
    );
    const { result } = renderHook(() => useTaskRow("d1", useTasksStore.getState().today));
    await act(async () => result.current.setPriority(null));
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d1")!.custom_fields.daily_priority,
    ).toBeUndefined();
  });

  it("startEdit / commitEdit writes the draft via the store", async () => {
    const { result } = renderHook(() => useTaskRow("d5", useTasksStore.getState().today));
    act(() => result.current.startEdit("讀文件"));
    expect(result.current.isEditing).toBe(true);
    act(() => result.current.changeDraft("讀完文件"));
    await act(async () => result.current.commitEdit());
    expect(result.current.isEditing).toBe(false);
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")!.title).toBe("讀完文件");
  });

  it("cancelEdit leaves the title untouched", () => {
    const { result } = renderHook(() => useTaskRow("d5", useTasksStore.getState().today));
    act(() => result.current.startEdit("讀文件"));
    act(() => result.current.changeDraft("亂改"));
    act(() => result.current.cancelEdit());
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")!.title).toBe(
      "讀 WSPC custom fields 文件",
    );
  });

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
});
