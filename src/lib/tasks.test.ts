import { describe, it, expect } from "vitest";
import type { Task } from "./types";
import { primaryDate, primaryMonth, layer, tasksOnDate, tasksOnMonth, nextFreeDailySlot, delayKind, delaySummary, dayInWeek } from "./tasks";
import { weekOf } from "./date";

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

describe("primaryMonth", () => {
  it("returns null when scheduled_months is empty", () => {
    const t = makeTask({ id: "1", custom_fields: {} });
    expect(primaryMonth(t)).toBeNull();
  });

  it("returns last scheduled month when no unscheduled_month", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_months: ["2026-04", "2026-05"] },
    });
    expect(primaryMonth(t)).toBe("2026-05");
  });

  it("returns null when last <= unscheduled_month (in backlog)", () => {
    const t = makeTask({
      id: "1",
      custom_fields: {
        scheduled_months: ["2026-04"],
        unscheduled_month: "2026-04",
      },
    });
    expect(primaryMonth(t)).toBeNull();
  });

  it("returns last when re-promoted after unscheduled", () => {
    const t = makeTask({
      id: "1",
      custom_fields: {
        scheduled_months: ["2026-04", "2026-05"],
        unscheduled_month: "2026-04",
      },
    });
    expect(primaryMonth(t)).toBe("2026-05");
  });
});

describe("primaryDate", () => {
  it("returns null when scheduled_dates is empty", () => {
    const t = makeTask({ id: "1", custom_fields: {} });
    expect(primaryDate(t)).toBeNull();
  });

  it("returns last scheduled date when no unscheduled_at", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_dates: ["2026-05-20", "2026-05-22"] },
    });
    expect(primaryDate(t)).toBe("2026-05-22");
  });

  it("returns null when last <= unscheduled_at (dismissed)", () => {
    const t = makeTask({
      id: "1",
      custom_fields: {
        scheduled_dates: ["2026-05-20"],
        unscheduled_at: "2026-05-20",
      },
    });
    expect(primaryDate(t)).toBeNull();
  });
});

describe("layer", () => {
  it("returns 'backlog' when both primaries are null", () => {
    const t = makeTask({ id: "1", custom_fields: {} });
    expect(layer(t)).toBe("backlog");
  });

  it("returns 'monthly' when only primaryMonth is set", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_months: ["2026-05"] },
    });
    expect(layer(t)).toBe("monthly");
  });

  it("returns 'daily' when primaryDate is set", () => {
    const t = makeTask({
      id: "1",
      custom_fields: {
        scheduled_months: ["2026-05"],
        scheduled_dates: ["2026-05-22"],
      },
    });
    expect(layer(t)).toBe("daily");
  });
});

describe("tasksOnDate", () => {
  it("returns empty when no tasks scheduled on date", () => {
    const tasks = [makeTask({ id: "1", custom_fields: {} })];
    expect(tasksOnDate(tasks, "2026-05-22")).toEqual([]);
  });

  it("returns primary when date is last and after unscheduled_at", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_dates: ["2026-05-22"] },
    });
    expect(tasksOnDate([t], "2026-05-22")).toEqual([{ task: t, kind: "primary" }]);
  });

  it("returns forwarded for non-last occurrence", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_dates: ["2026-05-20", "2026-05-22"] },
    });
    expect(tasksOnDate([t], "2026-05-20")).toEqual([{ task: t, kind: "forwarded" }]);
    expect(tasksOnDate([t], "2026-05-22")).toEqual([{ task: t, kind: "primary" }]);
  });

  it("returns dismissed when last equals unscheduled_at", () => {
    const t = makeTask({
      id: "1",
      custom_fields: {
        scheduled_dates: ["2026-05-22"],
        unscheduled_at: "2026-05-22",
      },
    });
    expect(tasksOnDate([t], "2026-05-22")).toEqual([{ task: t, kind: "dismissed" }]);
  });
});

describe("tasksOnMonth", () => {
  it("returns primary when month is last and after unscheduled_month", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_months: ["2026-05"] },
    });
    expect(tasksOnMonth([t], "2026-05")).toEqual([{ task: t, kind: "primary" }]);
  });

  it("returns forwarded for non-last month", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_months: ["2026-04", "2026-05"] },
    });
    expect(tasksOnMonth([t], "2026-04")).toEqual([{ task: t, kind: "forwarded" }]);
  });

  it("returns dismissed when month equals unscheduled_month", () => {
    const t = makeTask({
      id: "1",
      custom_fields: {
        scheduled_months: ["2026-05"],
        unscheduled_month: "2026-05",
      },
    });
    expect(tasksOnMonth([t], "2026-05")).toEqual([{ task: t, kind: "dismissed" }]);
  });
});

describe("nextFreeDailySlot", () => {
  const onDay = (id: string, p?: "1" | "2" | "3"): Task => ({
    id, title: id, status: "open", created_at: "x", updated_at: "x",
    custom_fields: { scheduled_dates: ["2026-06-08"], ...(p ? { daily_priority: p } : {}) },
  });

  it("returns 1 when the day has no prioritised tasks", () => {
    expect(nextFreeDailySlot([onDay("a")], "2026-06-08")).toBe("1");
  });

  it("returns the first free slot", () => {
    expect(nextFreeDailySlot([onDay("a", "1"), onDay("b", "3")], "2026-06-08")).toBe("2");
  });

  it("returns 3 (evict) when all three slots are taken", () => {
    expect(
      nextFreeDailySlot([onDay("a", "1"), onDay("b", "2"), onDay("c", "3")], "2026-06-08"),
    ).toBe("3");
  });

  it("ignores tasks not primary on that day", () => {
    const other: Task = {
      id: "x", title: "x", status: "open", created_at: "x", updated_at: "x",
      custom_fields: { scheduled_dates: ["2026-06-09"], daily_priority: "1" },
    };
    expect(nextFreeDailySlot([other], "2026-06-08")).toBe("1");
  });

  it("excludes the specified task so a re-dragged top-3 task keeps slot 1", () => {
    // Simulates: task "a" already has priority "1" on this date; when dragged
    // onto another day it is moved first, then nextFreeDailySlot is called.
    // Without excludeId the task would count itself and return "2".
    const task = onDay("a", "1");
    expect(nextFreeDailySlot([task], "2026-06-08", "a")).toBe("1");
  });

  it("excludeId does not affect other tasks — still respects their slots", () => {
    // Two other tasks occupy slots 1 and 3; excludeId targets a third task.
    // Slot 2 should be returned as the first free slot.
    expect(
      nextFreeDailySlot([onDay("a", "1"), onDay("b", "3"), onDay("c", "2")], "2026-06-08", "c"),
    ).toBe("2");
  });
});

describe("delayKind", () => {
  it("returns 'carried' when scheduled in an earlier month", () => {
    const t = makeTask({ id: "1", custom_fields: { scheduled_months: ["2026-04", "2026-06"] } });
    expect(delayKind(t, "2026-06")).toBe("carried");
  });

  it("returns 'dismissed' when unscheduled_at falls in this month", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_months: ["2026-06"], unscheduled_at: "2026-06-15" },
    });
    expect(delayKind(t, "2026-06")).toBe("dismissed");
  });

  it("prefers 'carried' over 'dismissed' when both apply", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_months: ["2026-05", "2026-06"], unscheduled_at: "2026-06-15" },
    });
    expect(delayKind(t, "2026-06")).toBe("carried");
  });

  it("returns 'none' for a fresh this-month task", () => {
    const t = makeTask({ id: "1", custom_fields: { scheduled_months: ["2026-06"] } });
    expect(delayKind(t, "2026-06")).toBe("none");
  });

  it("does not treat a previous month's unscheduled_at as this-month dismissed", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_months: ["2026-06"], unscheduled_at: "2026-05-30" },
    });
    expect(delayKind(t, "2026-06")).toBe("none");
  });
});

describe("delaySummary", () => {
  it("reports carried months and the earliest month", () => {
    const t = makeTask({ id: "1", custom_fields: { scheduled_months: ["2026-04", "2026-06"] } });
    expect(delaySummary(t, "2026-06")).toEqual({
      carriedMonths: 2,
      earliestMonth: "2026-04",
      dismissedDate: null,
    });
  });

  it("reports the dismissed date when unscheduled_at is this month", () => {
    const t = makeTask({
      id: "1",
      custom_fields: { scheduled_months: ["2026-06"], unscheduled_at: "2026-06-15" },
    });
    expect(delaySummary(t, "2026-06")).toEqual({
      carriedMonths: 0,
      earliestMonth: null,
      dismissedDate: "2026-06-15",
    });
  });

  it("reports zero delay for a fresh this-month task", () => {
    const t = makeTask({ id: "1", custom_fields: { scheduled_months: ["2026-06"] } });
    expect(delaySummary(t, "2026-06")).toEqual({
      carriedMonths: 0,
      earliestMonth: null,
      dismissedDate: null,
    });
  });
});

describe("dayInWeek", () => {
  const wk = weekOf("2099-01-15");
  const mk = (dates?: string[], u?: string): Task => ({
    id: "t", title: "t", status: "open", created_at: "x", updated_at: "x",
    custom_fields: { scheduled_dates: dates, unscheduled_at: u },
  });
  it("returns the day when primaryDate falls inside the week", () => {
    expect(dayInWeek(mk(["2099-01-15"]), wk)).toBe("2099-01-15");
  });
  it("returns null when primaryDate is outside the week", () => {
    expect(dayInWeek(mk(["2099-01-28"]), wk)).toBeNull();
  });
  it("returns null when there is no scheduled date", () => {
    expect(dayInWeek(mk(undefined), wk)).toBeNull();
  });
  it("returns null when unscheduled_at cancels the date", () => {
    expect(dayInWeek(mk(["2099-01-15"], "2099-01-20"), wk)).toBeNull();
  });
});
