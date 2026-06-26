import { describe, it, expect } from "vitest";
import { reorderPriority, reorderInPool } from "./taskOps";
import { dailyRankOn } from "@/lib/tasks";
import type { Task } from "@/lib/types";

function dayTask(id: string, date: string, p?: string, pos?: string): Task {
  return {
    id,
    title: id,
    status: "open",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    custom_fields: {
      scheduled_dates: [date],
      ...(p ? { daily_ranks: [`${date}:${p}`] } : {}),
      ...(pos ? { position: pos } : {}),
    },
  };
}

const D = "2026-06-10";

describe("reorderPriority (daily)", () => {
  it("swaps order within an existing top-3", () => {
    const tasks = [dayTask("a", D, "1"), dayTask("b", D, "2"), dayTask("c", D, "3")];
    const next = reorderPriority(tasks, "c", "1", "daily", D);
    const p = (id: string) => dailyRankOn(next.find((t) => t.id === id)!, D);
    expect(p("c")).toBe("1");
    expect(p("a")).toBe("2");
    expect(p("b")).toBe("3");
  });

  it("inserts an other task at rank 2, pushing 2→3 and overflowing old 3 to other", () => {
    const tasks = [
      dayTask("a", D, "1"),
      dayTask("b", D, "2"),
      dayTask("c", D, "3"),
      dayTask("x", D, undefined, "m"), // an existing other-pool task
    ];
    const next = reorderPriority(tasks, "x", "2", "daily", D);
    const t = (id: string) => next.find((tt) => tt.id === id)!;
    expect(dailyRankOn(t("x"), D)).toBe("2");
    expect(dailyRankOn(t("a"), D)).toBe("1");
    expect(dailyRankOn(t("b"), D)).toBe("3");
    // old 3 (c) overflowed: priority cleared, position sorts before the pool min ("m")
    expect(dailyRankOn(t("c"), D)).toBeNull();
    expect(t("c").custom_fields.position! < "m").toBe(true);
  });

  it("keeps a single ① without forcing ②③", () => {
    const tasks = [dayTask("a", D, "1"), dayTask("x", D, undefined, "m")];
    const next = reorderPriority(tasks, "a", "1", "daily", D);
    expect(dailyRankOn(next.find((t) => t.id === "a")!, D)).toBe("1");
    expect(dailyRankOn(next.find((t) => t.id === "x")!, D)).toBeNull();
  });

  it("promoting into a non-full top-3 does not overflow", () => {
    const tasks = [dayTask("a", D, "1"), dayTask("x", D, undefined, "m")];
    const next = reorderPriority(tasks, "x", "2", "daily", D);
    expect(dailyRankOn(next.find((t) => t.id === "x")!, D)).toBe("2");
    expect(dailyRankOn(next.find((t) => t.id === "a")!, D)).toBe("1");
  });
});

describe("reorderInPool", () => {
  it("sets position between prev and next neighbours", () => {
    const tasks = [dayTask("a", D, undefined, "a"), dayTask("b", D, undefined, "c"), dayTask("x", D, undefined, "z")];
    const next = reorderInPool(tasks, "x", "a", "b");
    const pos = next.find((t) => t.id === "x")!.custom_fields.position!;
    expect(pos > "a" && pos < "c").toBe(true);
  });
  it("moving to head uses null prev", () => {
    const tasks = [dayTask("a", D, undefined, "m"), dayTask("x", D, undefined, "z")];
    const next = reorderInPool(tasks, "x", null, "a");
    expect(next.find((t) => t.id === "x")!.custom_fields.position! < "m").toBe(true);
  });
});
