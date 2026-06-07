import { describe, it, expect } from "vitest";
import type { Task } from "@/lib/types";
import {
  toggleDone,
  addTodayTask,
  editTitle,
  deleteTask,
  restoreTask,
  setDailyPriority,
  setAdhoc,
  promoteToDay,
  setMonthlyPriority,
  addMonthTask,
  addBacklogTask,
  promoteToMonth,
  planScheduleDay,
} from "./taskOps";

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: `task-${overrides.id}`,
    status: "open",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    custom_fields: {},
    ...overrides,
  };
}

const NOW = "2026-05-22T09:00:00.000Z";

describe("toggleDone", () => {
  it("marks an open task as done and writes done_on", () => {
    const tasks = [makeTask({ id: "a" })];
    const next = toggleDone(tasks, "a", NOW);
    expect(next[0].status).toBe("done");
    expect(next[0].custom_fields.done_on).toBe(NOW);
  });

  it("reopens a done task and clears done_on", () => {
    const tasks = [makeTask({ id: "a", status: "done", custom_fields: { done_on: NOW } })];
    const next = toggleDone(tasks, "a", NOW);
    expect(next[0].status).toBe("open");
    expect(next[0].custom_fields.done_on).toBeUndefined();
  });

  it("does not mutate the input array", () => {
    const tasks = [makeTask({ id: "a" })];
    toggleDone(tasks, "a", NOW);
    expect(tasks[0].status).toBe("open");
  });

  it("returns the original array reference when the id is not found", () => {
    const tasks = [makeTask({ id: "a" })];
    const next = toggleDone(tasks, "not-found", NOW);
    expect(next).toBe(tasks);
  });

  it("cleans up done_on property from custom_fields if it is undefined", () => {
    const tasks = [
      makeTask({ id: "a", status: "done", custom_fields: { done_on: NOW, is_adhoc: "true" } }),
    ];
    const next = toggleDone(tasks, "a", NOW);
    expect("done_on" in next[0].custom_fields).toBe(false);
  });
});

describe("addTodayTask", () => {
  it("appends an adhoc task scheduled for today", () => {
    const next = addTodayTask([], "回電話", "2026-05-22", "new-id", NOW);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      id: "new-id",
      title: "回電話",
      status: "open",
      created_at: NOW,
      custom_fields: { scheduled_dates: ["2026-05-22"], is_adhoc: "true" },
    });
  });

  it("trims the title", () => {
    const next = addTodayTask([], "  買菜  ", "2026-05-22", "x", NOW);
    expect(next[0].title).toBe("買菜");
  });

  it("ignores a blank title", () => {
    const next = addTodayTask([], "   ", "2026-05-22", "x", NOW);
    expect(next).toHaveLength(0);
  });
});

describe("editTitle", () => {
  it("updates the title and updated_at", () => {
    const tasks = [makeTask({ id: "a", title: "舊" })];
    const next = editTitle(tasks, "a", "新標題", NOW);
    expect(next[0].title).toBe("新標題");
    expect(next[0].updated_at).toBe(NOW);
  });

  it("trims the new title", () => {
    const tasks = [makeTask({ id: "a" })];
    const next = editTitle(tasks, "a", "  乾淨  ", NOW);
    expect(next[0].title).toBe("乾淨");
  });

  it("leaves the task unchanged and returns the original reference when the new title is blank", () => {
    const tasks = [makeTask({ id: "a", title: "保留" })];
    const next = editTitle(tasks, "a", "   ", NOW);
    expect(next[0].title).toBe("保留");
    expect(next).toBe(tasks);
  });

  it("returns the original reference when the id is not found", () => {
    const tasks = [makeTask({ id: "a", title: "保留" })];
    const next = editTitle(tasks, "not-found", "新標題", NOW);
    expect(next).toBe(tasks);
  });
});

describe("deleteTask / restoreTask", () => {
  it("removes the task and reports its original index", () => {
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" }), makeTask({ id: "c" })];
    const { tasks: next, removed } = deleteTask(tasks, "b");
    expect(next.map((t) => t.id)).toEqual(["a", "c"]);
    expect(removed).toEqual({ task: tasks[1], index: 1 });
  });

  it("returns removed=null when id not found", () => {
    const tasks = [makeTask({ id: "a" })];
    const { tasks: next, removed } = deleteTask(tasks, "zzz");
    expect(next).toHaveLength(1);
    expect(removed).toBeNull();
  });

  it("does not mutate the original tasks array", () => {
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" })];
    const originalJson = JSON.stringify(tasks);
    const { tasks: next } = deleteTask(tasks, "a");
    expect(JSON.stringify(tasks)).toBe(originalJson);
    expect(next).not.toBe(tasks);
  });

  it("restoreTask puts the task back at its original index", () => {
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "c" })];
    const removed = { task: makeTask({ id: "b" }), index: 1 };
    const next = restoreTask(tasks, removed);
    expect(next.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("returns the original array reference if removed is null or undefined", () => {
    const tasks = [makeTask({ id: "a" })];
    const nextNull = restoreTask(tasks, null);
    const nextUndefined = restoreTask(tasks, undefined);
    expect(nextNull).toBe(tasks);
    expect(nextUndefined).toBe(tasks);
  });
});

describe("setDailyPriority", () => {
  const today = "2026-05-22";
  const onToday = (id: string, p?: "1" | "2" | "3") =>
    makeTask({
      id,
      custom_fields: { scheduled_dates: [today], ...(p ? { daily_priority: p } : {}) },
    });

  it("assigns a priority to a task that had none", () => {
    const tasks = [onToday("a")];
    const next = setDailyPriority(tasks, "a", "1", today);
    expect(next[0].custom_fields.daily_priority).toBe("1");
  });

  it("evicts the task that already held that priority today", () => {
    const tasks = [onToday("a", "1"), onToday("b")];
    const next = setDailyPriority(tasks, "b", "1", today);
    expect(next.find((t) => t.id === "b")!.custom_fields.daily_priority).toBe("1");
    expect(next.find((t) => t.id === "a")!.custom_fields.daily_priority).toBeUndefined();
  });

  it("does not evict a same-priority task scheduled on a different day", () => {
    const other = makeTask({
      id: "x",
      custom_fields: { scheduled_dates: ["2026-05-24"], daily_priority: "1" },
    });
    const tasks = [other, onToday("b")];
    const next = setDailyPriority(tasks, "b", "1", today);
    expect(next.find((t) => t.id === "x")!.custom_fields.daily_priority).toBe("1");
  });

  it("does not evict a priority on a task scheduled for a different date (cross-date isolation)", () => {
    const a = makeTask({
      id: "a",
      custom_fields: { scheduled_dates: ["2026-06-10"], daily_priority: "1" },
    });
    const b = makeTask({
      id: "b",
      custom_fields: { scheduled_dates: ["2026-06-17"] },
    });
    const tasks = [a, b];
    const next = setDailyPriority(tasks, "b", "1", "2026-06-17");
    expect(next.find((t) => t.id === "b")!.custom_fields.daily_priority).toBe("1");
    expect(next.find((t) => t.id === "a")!.custom_fields.daily_priority).toBe("1");
  });

  it("removes the priority when n is null", () => {
    const tasks = [onToday("a", "2")];
    const next = setDailyPriority(tasks, "a", null, today);
    expect(next[0].custom_fields.daily_priority).toBeUndefined();
  });

  it("returns the original reference and does not evict other tasks if target ID is not found", () => {
    const tasks = [onToday("a", "1")];
    const next = setDailyPriority(tasks, "not-found", "1", today);
    expect(next).toBe(tasks);
    expect(next[0].custom_fields.daily_priority).toBe("1");
  });
});

describe("setAdhoc", () => {
  it("sets is_adhoc to the given value", () => {
    const tasks = [
      {
        id: "x",
        title: "t",
        status: "open",
        created_at: "",
        updated_at: "",
        custom_fields: { is_adhoc: "true" },
      },
    ] as never as Task[];
    const next = setAdhoc(tasks, "x", false);
    expect(next.find((t) => t.id === "x")!.custom_fields.is_adhoc).toBe("false");
  });

  it("returns the same array when id is missing", () => {
    const tasks: Task[] = [];
    expect(setAdhoc(tasks, "nope", true)).toBe(tasks);
  });
});

// helper for month-layer tests
function mk(id: string, cf: Record<string, unknown>) {
  return {
    id,
    title: id,
    status: "open" as const,
    created_at: "x",
    updated_at: "x",
    custom_fields: cf,
  };
}

describe("promoteToDay", () => {
  it("appends the date to scheduled_dates", () => {
    const tasks = [mk("a", { scheduled_months: ["2026-05"] })];
    const out = promoteToDay(tasks, "a", "2026-05-22");
    expect(out[0].custom_fields.scheduled_dates).toEqual(["2026-05-22"]);
  });
  it("is a no-op when date is already the last entry", () => {
    const tasks = [mk("a", { scheduled_dates: ["2026-05-21", "2026-05-22"] })];
    const out = promoteToDay(tasks, "a", "2026-05-22");
    expect(out[0].custom_fields.scheduled_dates).toEqual(["2026-05-21", "2026-05-22"]);
  });
});

describe("setMonthlyPriority", () => {
  it("sets priority and evicts the collider within the same month", () => {
    const tasks = [
      mk("a", { scheduled_months: ["2026-05"], monthly_priority: "1" }),
      mk("b", { scheduled_months: ["2026-05"] }),
    ];
    const out = setMonthlyPriority(tasks, "b", "1", "2026-05");
    expect(out.find((t) => t.id === "b")!.custom_fields.monthly_priority).toBe("1");
    expect(out.find((t) => t.id === "a")!.custom_fields.monthly_priority).toBeUndefined();
  });
  it("does not evict a collider in a different month", () => {
    const tasks = [
      mk("a", { scheduled_months: ["2026-04"], monthly_priority: "1" }),
      mk("b", { scheduled_months: ["2026-05"] }),
    ];
    const out = setMonthlyPriority(tasks, "b", "1", "2026-05");
    expect(out.find((t) => t.id === "a")!.custom_fields.monthly_priority).toBe("1");
  });
  it("clears priority when n is null", () => {
    const tasks = [mk("a", { scheduled_months: ["2026-05"], monthly_priority: "2" })];
    const out = setMonthlyPriority(tasks, "a", null, "2026-05");
    expect(out[0].custom_fields.monthly_priority).toBeUndefined();
  });
});

describe("addMonthTask", () => {
  it("creates a month-scoped non-adhoc task", () => {
    const out = addMonthTask([], "計畫", "2026-05", "tmp-1", "2026-05-01T00:00:00Z");
    expect(out[0].custom_fields.scheduled_months).toEqual(["2026-05"]);
    expect(out[0].custom_fields.is_adhoc).toBe("false");
  });
});

describe("addBacklogTask", () => {
  it("appends a backlog task with empty scheduled_* and is_adhoc false", () => {
    const next = addBacklogTask([], "讀一本書", "tmp", NOW);
    expect(next).toHaveLength(1);
    expect(next[0].custom_fields.scheduled_months).toEqual([]);
    expect(next[0].custom_fields.scheduled_dates).toEqual([]);
    expect(next[0].custom_fields.is_adhoc).toBe("false");
  });

  it("ignores blank titles", () => {
    expect(addBacklogTask([], "   ", "tmp", NOW)).toEqual([]);
  });
});

describe("promoteToMonth", () => {
  it("appends the month to scheduled_months", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_months: [] } })];
    const next = promoteToMonth(tasks, "a", "2026-06");
    expect(next[0].custom_fields.scheduled_months).toEqual(["2026-06"]);
  });

  it("is a no-op (same ref) when the month is already the last entry", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_months: ["2026-06"] } })];
    expect(promoteToMonth(tasks, "a", "2026-06")).toBe(tasks);
  });
});

describe("planScheduleDay", () => {
  it("appends the date when the task has no primary date (first placement)", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_months: ["2026-06"] } })];
    const next = planScheduleDay(tasks, "a", "2026-06-08");
    expect(next[0].custom_fields.scheduled_dates).toEqual(["2026-06-08"]);
  });

  it("backfills the month when scheduling a backlog task to a day", () => {
    const tasks = [makeTask({ id: "a", custom_fields: {} })];
    const next = planScheduleDay(tasks, "a", "2026-06-08");
    expect(next[0].custom_fields.scheduled_dates).toEqual(["2026-06-08"]);
    expect(next[0].custom_fields.scheduled_months).toEqual(["2026-06"]);
  });

  it("replaces the last date when re-planning a task already on a day", () => {
    const tasks = [
      makeTask({
        id: "a",
        custom_fields: { scheduled_months: ["2026-06"], scheduled_dates: ["2026-06-08"] },
      }),
    ];
    const next = planScheduleDay(tasks, "a", "2026-06-10");
    expect(next[0].custom_fields.scheduled_dates).toEqual(["2026-06-10"]);
  });

  it("preserves earlier trail entries when re-planning the current placement", () => {
    const tasks = [
      makeTask({
        id: "a",
        custom_fields: {
          scheduled_months: ["2026-06"],
          scheduled_dates: ["2026-06-01", "2026-06-08"],
        },
      }),
    ];
    const next = planScheduleDay(tasks, "a", "2026-06-10");
    expect(next[0].custom_fields.scheduled_dates).toEqual(["2026-06-01", "2026-06-10"]);
  });

  it("is a no-op (same ref) when re-planning to the date already last", () => {
    const tasks = [
      makeTask({
        id: "a",
        custom_fields: { scheduled_months: ["2026-06"], scheduled_dates: ["2026-06-08"] },
      }),
    ];
    expect(planScheduleDay(tasks, "a", "2026-06-08")).toBe(tasks);
  });
});
