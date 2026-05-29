import { describe, it, expect, beforeEach } from "vitest";
import { useTasksStore } from "./tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";

beforeEach(() => {
  localStorage.clear();
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, recentlyDeleted: null });
});

describe("useTasksStore", () => {
  it("seeds today from MOCK_TODAY", () => {
    expect(useTasksStore.getState().today).toBe(MOCK_TODAY);
  });

  it("toggleDone flips status and persists to localStorage", () => {
    useTasksStore.getState().toggleDone("d5");
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")!.status).toBe("done");
    const stored = JSON.parse(localStorage.getItem("desk.tasks")!);
    expect(stored.state.tasks.find((t: { id: string }) => t.id === "d5").status).toBe("done");
  });

  it("deleteTask stashes recentlyDeleted and restoreTask brings it back", () => {
    const before = useTasksStore.getState().tasks.length;
    useTasksStore.getState().deleteTask("d6");
    expect(useTasksStore.getState().tasks).toHaveLength(before - 1);
    expect(useTasksStore.getState().recentlyDeleted?.task.id).toBe("d6");
    useTasksStore.getState().restoreTask();
    expect(useTasksStore.getState().tasks).toHaveLength(before);
    expect(useTasksStore.getState().recentlyDeleted).toBeNull();
  });

  it("addTodayTask adds a task scheduled for store.today", () => {
    useTasksStore.getState().addTodayTask("臨時一件");
    const added = useTasksStore.getState().tasks.find((t) => t.title === "臨時一件");
    expect(added?.custom_fields.scheduled_dates).toEqual([MOCK_TODAY]);
    expect(added?.custom_fields.is_adhoc).toBe("true");
  });

  it("setDailyPriority routes through store.today for eviction", () => {
    useTasksStore.getState().setDailyPriority("d5", "1");
    const s = useTasksStore.getState();
    expect(s.tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority).toBe("1");
    expect(s.tasks.find((t) => t.id === "d1")!.custom_fields.daily_priority).toBeUndefined();
  });
});
