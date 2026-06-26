import { describe, it, expect } from "vitest";
import type { Task, Priority } from "@/lib/types";
import {
  toggleDone,
  addTodayTask,
  editTitle,
  deleteTask,
  restoreTask,
  setDailyPriority,
  setAdhoc,
  setMonthlyPriority,
  addMonthTask,
  addBacklogTask,
  promoteToMonth,
  planScheduleDay,
  moveToToday,
  demoteToMonth,
  moveToNextMonth,
  demoteToBacklog,
} from "./taskOps";
import { primaryDate, layer, dailyRankOn, monthlyRankOn } from "@/lib/tasks";

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
    const next = addTodayTask([], "回電話", "2026-05-22", "new-id", NOW, true);
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
    const next = addTodayTask([], "  買菜  ", "2026-05-22", "x", NOW, true);
    expect(next[0].title).toBe("買菜");
  });

  it("ignores a blank title", () => {
    const next = addTodayTask([], "   ", "2026-05-22", "x", NOW, true);
    expect(next).toHaveLength(0);
  });

  it("respects the isAdhoc flag", () => {
    const planned = addTodayTask([], "計畫的事", "2026-05-22", "p", NOW, false);
    expect(planned[0].custom_fields.is_adhoc).toBe("false");
    const adhoc = addTodayTask([], "臨時的事", "2026-05-22", "a", NOW, true);
    expect(adhoc[0].custom_fields.is_adhoc).toBe("true");
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
  // Seed the per-period array (daily_ranks) — the new storage. The legacy single
  // value is migrated away on first write, so tests assert against daily_ranks.
  const onToday = (id: string, p?: "1" | "2" | "3") =>
    makeTask({
      id,
      custom_fields: { scheduled_dates: [today], ...(p ? { daily_ranks: [`${today}:${p}`] } : {}) },
    });

  it("writes the rank into daily_ranks for that date and clears the legacy field", () => {
    const tasks = [onToday("a")];
    const next = setDailyPriority(tasks, "a", "1", today);
    expect(next[0].custom_fields.daily_ranks).toEqual([`${today}:1`]);
    expect(next[0].custom_fields.daily_priority).toBeUndefined();
  });

  it("evicts the task that already held that priority today", () => {
    const tasks = [onToday("a", "1"), onToday("b")];
    const next = setDailyPriority(tasks, "b", "1", today);
    expect(dailyRankOn(next.find((t) => t.id === "b")!, today)).toBe("1");
    expect(dailyRankOn(next.find((t) => t.id === "a")!, today)).toBeNull();
  });

  it("does not evict a same-priority task scheduled on a different day", () => {
    const other = makeTask({
      id: "x",
      custom_fields: { scheduled_dates: ["2026-05-24"], daily_ranks: ["2026-05-24:1"] },
    });
    const tasks = [other, onToday("b")];
    const next = setDailyPriority(tasks, "b", "1", today);
    expect(next.find((t) => t.id === "x")!.custom_fields.daily_ranks).toEqual(["2026-05-24:1"]);
  });

  it("does not evict a priority on a task scheduled for a different date (cross-date isolation)", () => {
    const a = makeTask({
      id: "a",
      custom_fields: { scheduled_dates: ["2026-06-10"], daily_ranks: ["2026-06-10:1"] },
    });
    const b = makeTask({
      id: "b",
      custom_fields: { scheduled_dates: ["2026-06-17"] },
    });
    const tasks = [a, b];
    const next = setDailyPriority(tasks, "b", "1", "2026-06-17");
    expect(dailyRankOn(next.find((t) => t.id === "b")!, "2026-06-17")).toBe("1");
    expect(dailyRankOn(next.find((t) => t.id === "a")!, "2026-06-10")).toBe("1");
  });

  it("removes the priority when n is null", () => {
    const tasks = [onToday("a", "2")];
    const next = setDailyPriority(tasks, "a", null, today);
    expect(dailyRankOn(next[0], today)).toBeNull();
    expect(next[0].custom_fields.daily_priority).toBeUndefined();
  });

  it("returns the original reference and does not evict other tasks if target ID is not found", () => {
    const tasks = [onToday("a", "1")];
    const next = setDailyPriority(tasks, "not-found", "1", today);
    expect(next).toBe(tasks);
    expect(dailyRankOn(next[0], today)).toBe("1");
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

describe("setMonthlyPriority", () => {
  it("sets priority and evicts the collider within the same month", () => {
    const tasks = [
      mk("a", { scheduled_months: ["2026-05"], monthly_ranks: ["2026-05:1"] }),
      mk("b", { scheduled_months: ["2026-05"] }),
    ];
    const out = setMonthlyPriority(tasks, "b", "1", "2026-05");
    expect(monthlyRankOn(out.find((t) => t.id === "b")!, "2026-05")).toBe("1");
    expect(monthlyRankOn(out.find((t) => t.id === "a")!, "2026-05")).toBeNull();
  });
  it("does not evict a collider in a different month", () => {
    const tasks = [
      mk("a", { scheduled_months: ["2026-04"], monthly_ranks: ["2026-04:1"] }),
      mk("b", { scheduled_months: ["2026-05"] }),
    ];
    const out = setMonthlyPriority(tasks, "b", "1", "2026-05");
    expect(monthlyRankOn(out.find((t) => t.id === "a")!, "2026-04")).toBe("1");
  });
  it("clears priority when n is null", () => {
    const tasks = [mk("a", { scheduled_months: ["2026-05"], monthly_ranks: ["2026-05:2"] })];
    const out = setMonthlyPriority(tasks, "a", null, "2026-05");
    expect(monthlyRankOn(out[0], "2026-05")).toBeNull();
    expect(out[0].custom_fields.monthly_priority).toBeUndefined();
  });
});

describe("addMonthTask", () => {
  it("creates a month-scoped non-adhoc task", () => {
    const out = addMonthTask([], "計畫", "2026-05", "tmp-1", "2026-05-01T00:00:00Z", false);
    expect(out[0].custom_fields.scheduled_months).toEqual(["2026-05"]);
    expect(out[0].custom_fields.is_adhoc).toBe("false");
  });

  it("respects the isAdhoc flag", () => {
    const adhoc = addMonthTask([], "月中臨時", "2026-05", "a", NOW, true);
    expect(adhoc[0].custom_fields.is_adhoc).toBe("true");
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

describe("moveToToday", () => {
  const today = "2026-05-22";

  it("appends today and keeps the earlier day as a trail", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_dates: ["2026-05-20"] } })];
    const next = moveToToday(tasks, "a", today);
    expect(next[0].custom_fields.scheduled_dates).toEqual(["2026-05-20", today]);
  });

  it("keeps the source day's rank and assigns today a free slot", () => {
    const tasks = [
      makeTask({
        id: "a",
        custom_fields: { scheduled_dates: ["2026-05-20"], daily_ranks: ["2026-05-20:2"] },
      }),
    ];
    const next = moveToToday(tasks, "a", today);
    const cf = next[0].custom_fields;
    // source day's rank preserved as history
    expect(cf.daily_ranks).toContain("2026-05-20:2");
    // today gets a fresh free slot (first free is "1")
    expect(dailyRankOn(next[0], today)).toBe("1");
    // legacy single field cleared
    expect(cf.daily_priority).toBeUndefined();
  });

  it("drops to no priority on today when today's three-things is already full", () => {
    const onToday = (id: string, p: "1" | "2" | "3") =>
      makeTask({ id, custom_fields: { scheduled_dates: [today], daily_ranks: [`${today}:${p}`] } });
    const tasks = [
      onToday("x", "1"),
      onToday("y", "2"),
      onToday("z", "3"),
      makeTask({
        id: "a",
        custom_fields: { scheduled_dates: ["2026-05-20"], daily_ranks: ["2026-05-20:1"] },
      }),
    ];
    const next = moveToToday(tasks, "a", today);
    const moved = next.find((t) => t.id === "a")!;
    // source day rank still there; today gets no rank because all three slots are taken by OTHERS
    expect(moved.custom_fields.daily_ranks).toContain("2026-05-20:1");
    expect(dailyRankOn(moved, today)).toBeNull();
    expect(moved.custom_fields.daily_priority).toBeUndefined();
  });

  it("leaves a non-priority task without a rank on today", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_dates: ["2026-05-20"] } })];
    const next = moveToToday(tasks, "a", today);
    expect(dailyRankOn(next[0], today)).toBeNull();
    expect(next[0].custom_fields.daily_priority).toBeUndefined();
  });

  it("is a no-op (same ref) when already on today", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_dates: [today] } })];
    expect(moveToToday(tasks, "a", today)).toBe(tasks);
  });

  it("returns the same ref when id is not found", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_dates: ["2026-05-20"] } })];
    expect(moveToToday(tasks, "zz", today)).toBe(tasks);
  });

  it("does not mutate the input array", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_dates: ["2026-05-20"] } })];
    const json = JSON.stringify(tasks);
    moveToToday(tasks, "a", today);
    expect(JSON.stringify(tasks)).toBe(json);
  });
});

describe("demoteToMonth", () => {
  it("unschedules from the day and keeps the month it already belongs to", () => {
    const tasks = [
      makeTask({
        id: "a",
        custom_fields: { scheduled_months: ["2026-05"], scheduled_dates: ["2026-05-21"] },
      }),
    ];
    const next = demoteToMonth(tasks, "a", "2026-05");
    expect(next[0].custom_fields.unscheduled_at).toBe("2026-05-21");
    expect(next[0].custom_fields.scheduled_months).toEqual(["2026-05"]);
    expect(primaryDate(next[0])).toBeNull();
  });

  it("adds the current month for a day-only adhoc task that had no month", () => {
    const tasks = [
      makeTask({
        id: "a",
        custom_fields: { scheduled_dates: ["2026-05-21"], is_adhoc: "true" },
      }),
    ];
    const next = demoteToMonth(tasks, "a", "2026-05");
    expect(next[0].custom_fields.scheduled_months).toEqual(["2026-05"]);
    expect(next[0].custom_fields.unscheduled_at).toBe("2026-05-21");
    expect(next[0].custom_fields.is_adhoc).toBe("true"); // preserved
  });

  it("dismisses the day but keeps that day's rank entry (no daily_priority)", () => {
    const tasks = [
      makeTask({
        id: "a",
        custom_fields: {
          scheduled_months: ["2026-05"],
          scheduled_dates: ["2026-05-21"],
          daily_ranks: ["2026-05-21:1"],
        },
      }),
    ];
    const next = demoteToMonth(tasks, "a", "2026-05");
    // the day's rank entry is the preserved history
    expect(next[0].custom_fields.daily_ranks).toContain("2026-05-21:1");
    // the legacy single field is never written/kept
    expect(next[0].custom_fields.daily_priority).toBeUndefined();
    expect(next[0].custom_fields.unscheduled_at).toBe("2026-05-21");
    // but it is no longer the day's primary, so it can't collide with a ring elsewhere
    expect(primaryDate(next[0])).toBeNull();
  });

  it("preserves the scheduled_dates trail", () => {
    const tasks = [
      makeTask({
        id: "a",
        custom_fields: {
          scheduled_months: ["2026-05"],
          scheduled_dates: ["2026-05-19", "2026-05-21"],
        },
      }),
    ];
    const next = demoteToMonth(tasks, "a", "2026-05");
    expect(next[0].custom_fields.scheduled_dates).toEqual(["2026-05-19", "2026-05-21"]);
  });

  it("is a no-op (same ref) when the task is not on a day", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_months: ["2026-05"] } })];
    expect(demoteToMonth(tasks, "a", "2026-05")).toBe(tasks);
  });

  it("returns the same ref when id is not found", () => {
    const tasks = [makeTask({ id: "a", custom_fields: { scheduled_dates: ["2026-05-21"] } })];
    expect(demoteToMonth(tasks, "zz", "2026-05")).toBe(tasks);
  });
});

function monthTask(id: string, months: string[], priority?: Priority): Task {
  return makeTask({
    id,
    custom_fields: {
      scheduled_months: months,
      ...(priority ? { monthly_priority: priority } : {}),
    },
  });
}

describe("moveToNextMonth", () => {
  it("appends the next month and clears monthly_priority", () => {
    const tasks = [monthTask("a", ["2026-06"], "1")];
    const next = moveToNextMonth(tasks, "a");
    expect(next[0].custom_fields.scheduled_months).toEqual(["2026-06", "2026-07"]);
    expect(next[0].custom_fields.monthly_priority).toBeUndefined();
  });

  it("rolls over the year (12 -> next Jan)", () => {
    const tasks = [monthTask("a", ["2026-12"])];
    const next = moveToNextMonth(tasks, "a");
    expect(next[0].custom_fields.scheduled_months).toEqual(["2026-12", "2027-01"]);
  });

  it("is a no-op when the task has no scheduled month", () => {
    const tasks = [monthTask("a", [])];
    expect(moveToNextMonth(tasks, "a")).toBe(tasks);
  });

  it("is a no-op for an unknown id", () => {
    const tasks = [monthTask("a", ["2026-06"])];
    expect(moveToNextMonth(tasks, "zzz")).toBe(tasks);
  });

  it("defers further on a repeat (append-only, one month each time)", () => {
    const tasks = [monthTask("a", ["2026-06", "2026-07"])];
    const next = moveToNextMonth(tasks, "a");
    expect(next[0].custom_fields.scheduled_months).toEqual(["2026-06", "2026-07", "2026-08"]);
  });
});

describe("demoteToBacklog", () => {
  it("dismisses the active month and lands in backlog", () => {
    const tasks = [monthTask("a", ["2026-06"], "2")];
    const next = demoteToBacklog(tasks, "a", "2026-06-14");
    expect(next[0].custom_fields.unscheduled_month).toBe("2026-06");
    expect(next[0].custom_fields.unscheduled_at).toBe("2026-06-14");
    expect(next[0].custom_fields.monthly_priority).toBeUndefined();
    expect(next[0].custom_fields.daily_priority).toBeUndefined();
    expect(layer(next[0])).toBe("backlog");
  });

  it("is a no-op when the task has no scheduled month", () => {
    const tasks = [monthTask("a", [])];
    expect(demoteToBacklog(tasks, "a", "2026-06-14")).toBe(tasks);
  });

  it("dismisses a residual scheduled day so the task leaves the day layer", () => {
    const tasks = [
      makeTask({
        id: "a",
        custom_fields: {
          scheduled_months: ["2026-06"],
          scheduled_dates: ["2026-06-10"],
          daily_priority: "1",
          monthly_priority: "2",
        },
      }),
    ];
    const next = demoteToBacklog(tasks, "a", "2026-06-14");
    expect(primaryDate(next[0])).toBeNull();
    expect(next[0].custom_fields.daily_priority).toBeUndefined();
    expect(layer(next[0])).toBe("backlog");
  });

  it("dismisses a FUTURE scheduled day so the task still lands in backlog", () => {
    const tasks = [
      makeTask({
        id: "a",
        custom_fields: {
          scheduled_months: ["2026-06"],
          scheduled_dates: ["2026-06-20"], // after `today`
          daily_priority: "1",
          monthly_priority: "2",
        },
      }),
    ];
    const next = demoteToBacklog(tasks, "a", "2026-06-14");
    expect(next[0].custom_fields.unscheduled_at).toBe("2026-06-20"); // stamped the later date
    expect(primaryDate(next[0])).toBeNull();
    expect(layer(next[0])).toBe("backlog");
  });
});
