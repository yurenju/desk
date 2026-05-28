import { describe, it, expect } from "vitest";
import type { Task } from "./types";
import { primaryDate, primaryMonth, layer, tasksOnDate, tasksOnMonth } from "./tasks";

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
