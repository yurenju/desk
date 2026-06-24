import { describe, it, expect } from "vitest";
import type { Task } from "@/lib/types";
import {
  buildDayContainers,
  buildMonthContainers,
  computePreview,
  containerId,
  parseContainerId,
  planCommit,
  resolveOver,
} from "./planDrag";

const DATE = "2026-06-24";
const MONTH = "2026-06";

function task(id: string, cf: Partial<Task["custom_fields"]>): Task {
  return {
    id,
    title: id,
    status: "open",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    custom_fields: { scheduled_dates: [DATE], is_adhoc: "false", ...cf },
  };
}

describe("container id round-trip", () => {
  it("parses each namespace", () => {
    expect(parseContainerId(containerId({ kind: "top3", date: DATE }))).toEqual({
      kind: "top3",
      date: DATE,
    });
    expect(parseContainerId(containerId({ kind: "other", date: DATE }))).toEqual({
      kind: "other",
      date: DATE,
    });
    expect(parseContainerId("pool:backlog")).toEqual({ kind: "poolBacklog" });
    expect(parseContainerId("pool:month:2026-06")).toEqual({ kind: "poolMonth", month: "2026-06" });
    expect(parseContainerId(containerId({ kind: "monthTop3", month: MONTH }))).toEqual({
      kind: "monthTop3",
      month: MONTH,
    });
    expect(parseContainerId(`week:${DATE}:top3`)).toEqual({ kind: "weekTop3", date: DATE });
    expect(parseContainerId("drop:month")).toBeNull();
  });
});

describe("buildDayContainers", () => {
  it("splits primary tasks into top3 / other / adhoc, sorted", () => {
    const tasks = [
      task("p2", { daily_priority: "2" }),
      task("p1", { daily_priority: "1" }),
      task("o-b", { position: "b" }),
      task("o-a", { position: "a" }),
      task("ad", { is_adhoc: "true", position: "a" }),
    ];
    const map = buildDayContainers(tasks, DATE);
    expect(map.get(containerId({ kind: "top3", date: DATE }))).toEqual(["day:p1", "day:p2"]);
    expect(map.get(containerId({ kind: "other", date: DATE }))).toEqual(["day:o-a", "day:o-b"]);
    expect(map.get(containerId({ kind: "adhoc", date: DATE }))).toEqual(["day:ad"]);
  });
});

describe("computePreview overflow", () => {
  const top3 = containerId({ kind: "top3", date: DATE });
  const other = containerId({ kind: "other", date: DATE });
  const base = new Map<string, string[]>([
    [top3, ["day:p1", "day:p2", "day:p3"]],
    [other, ["day:o1", "day:o2"]],
  ]);

  it("inserting a 4th into a full top3 displaces the 3rd to other HEAD", () => {
    // Drop o1 into rank 2 (index 1) of a full top3.
    const pv = computePreview(base, "day:o1", other, top3, 1);
    expect(pv.get(top3)).toEqual(["day:p1", "day:o1", "day:p2"]);
    // p3 overflows to the head of other; o1 removed from other.
    expect(pv.get(other)).toEqual(["day:p3", "day:o2"]);
  });

  it("same-container reorder is a plain arrayMove", () => {
    const pv = computePreview(base, "day:p1", top3, top3, 2);
    expect(pv.get(top3)).toEqual(["day:p2", "day:p3", "day:p1"]);
    expect(pv.has(other)).toBe(false);
  });
});

describe("planCommit", () => {
  const top3 = containerId({ kind: "top3", date: DATE });
  const other = containerId({ kind: "other", date: DATE });

  it("top3 drop yields a rank plan at the hovered index", () => {
    const plan = planCommit({
      over: { container: top3, index: 1 },
      finalOrder: ["day:p1", "day:o1", "day:p2"],
      activeId: "day:o1",
      activeTask: task("o1", { position: "a" }),
    });
    expect(plan).toEqual({ kind: "rank", taskId: "o1", rank: 2, axis: "daily", scope: DATE });
  });

  it("other drop yields a pool plan with prev/next neighbours and demote flag", () => {
    const plan = planCommit({
      over: { container: other, index: 1 },
      finalOrder: ["day:o1", "day:x", "day:o2"],
      activeId: "day:x",
      activeTask: task("x", { daily_priority: "1" }), // carried a priority
    });
    expect(plan).toEqual({
      kind: "pool",
      taskId: "x",
      axis: "daily",
      scope: DATE,
      prevId: "o1",
      nextId: "o2",
      hadPriority: true,
      crossColumn: false,
    });
  });

  it("flags crossColumn when the active task is not primary on this day", () => {
    const plan = planCommit({
      over: { container: other, index: 0 },
      finalOrder: ["day:x"],
      activeId: "day:x",
      activeTask: task("x", { scheduled_dates: ["2026-06-20"] }), // primary on another day
    });
    expect(plan.kind === "pool" && plan.crossColumn).toBe(true);
  });
});

// A month task: primary on MONTH (scheduled_months ends at MONTH, not unscheduled).
function monthTask(id: string, cf: Partial<Task["custom_fields"]>): Task {
  return {
    id,
    title: id,
    status: "open",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    custom_fields: { scheduled_months: [MONTH], is_adhoc: "false", ...cf },
  };
}

describe("buildMonthContainers", () => {
  it("splits month primaries into monthTop3 (by priority) / poolMonth (其他任務)", () => {
    const tasks = [
      monthTask("m2", { monthly_priority: "2" }),
      monthTask("m1", { monthly_priority: "1" }),
      monthTask("o-b", { position: "b" }),
      monthTask("o-a", { position: "a" }),
      monthTask("ad", { is_adhoc: "true", position: "a" }), // adhoc sinks below 計劃內
    ];
    const map = buildMonthContainers(tasks, MONTH, DATE);
    expect(map.get(containerId({ kind: "monthTop3", month: MONTH }))).toEqual([
      "month:m1",
      "month:m2",
    ]);
    expect(map.get(containerId({ kind: "poolMonth", month: MONTH }))).toEqual([
      "month:o-a",
      "month:o-b",
      "month:ad",
    ]);
  });

  it("excludes tasks scheduled into the viewed week and done tasks from 其他任務", () => {
    const tasks: Task[] = [
      monthTask("inweek", { scheduled_dates: [DATE], position: "a" }), // dayInWeek != null
      { ...monthTask("done", { position: "b" }), status: "done" },
      monthTask("live", { position: "c" }),
    ];
    const map = buildMonthContainers(tasks, MONTH, DATE);
    expect(map.get(containerId({ kind: "poolMonth", month: MONTH }))).toEqual(["month:live"]);
  });
});

describe("month overflow + commit", () => {
  const mtop3 = containerId({ kind: "monthTop3", month: MONTH });
  const pool = containerId({ kind: "poolMonth", month: MONTH });
  const base = new Map<string, string[]>([
    [mtop3, ["month:m1", "month:m2", "month:m3"]],
    [pool, ["month:o1", "month:o2"]],
  ]);

  it("inserting a 4th into a full monthTop3 displaces the 3rd to poolMonth HEAD", () => {
    const pv = computePreview(base, "month:o1", pool, mtop3, 1);
    expect(pv.get(mtop3)).toEqual(["month:m1", "month:o1", "month:m2"]);
    // m3 overflows to the head of 其他任務; o1 removed from the pool.
    expect(pv.get(pool)).toEqual(["month:m3", "month:o2"]);
  });

  it("monthTop3 drop yields a monthly rank plan at the hovered index", () => {
    const plan = planCommit({
      over: { container: mtop3, index: 1 },
      finalOrder: ["month:m1", "month:o1", "month:m2"],
      activeId: "month:o1",
      activeTask: monthTask("o1", { position: "a" }),
    });
    expect(plan).toEqual({ kind: "rank", taskId: "o1", rank: 2, axis: "monthly", scope: MONTH });
  });

  it("poolMonth drop yields a monthly pool plan, never crossColumn, demoting prior priority", () => {
    const plan = planCommit({
      over: { container: pool, index: 1 },
      finalOrder: ["month:o1", "month:x", "month:o2"],
      activeId: "month:x",
      activeTask: monthTask("x", { monthly_priority: "1" }), // was a hero card member
    });
    expect(plan).toEqual({
      kind: "pool",
      taskId: "x",
      axis: "monthly",
      scope: MONTH,
      prevId: "o1",
      nextId: "o2",
      hadPriority: true,
      crossColumn: false,
    });
  });
});

describe("resolveOver", () => {
  const top3 = containerId({ kind: "top3", date: DATE });
  const base = new Map<string, string[]>([[top3, ["day:p1", "day:p2"]]]);

  it("resolves a direct container hit as append index", () => {
    expect(resolveOver(top3, base)).toEqual({ container: top3, index: 2 });
  });

  it("resolves a row hit to its container + index", () => {
    expect(resolveOver("day:p2", base)).toEqual({ container: top3, index: 1 });
  });
});
