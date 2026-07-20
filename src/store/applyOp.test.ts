import { describe, it, expect } from "vitest";
import type { Task } from "@/lib/types";
import { deriveTodoPatch } from "./applyOp";

function task(id: string, over: Partial<Task> = {}): Task {
  return {
    id,
    title: "t",
    status: "open",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    custom_fields: {},
    ...over,
  };
}

describe("deriveTodoPatch", () => {
  it("emits a changed scalar custom field", () => {
    const prev = task("a", { custom_fields: { is_adhoc: "false" } });
    const next = task("a", { custom_fields: { is_adhoc: "true" } });
    expect(deriveTodoPatch(prev, next)).toEqual({ is_adhoc: "true" });
  });

  it("sends null when a custom field is removed (clear semantics)", () => {
    const prev = task("a", { custom_fields: { daily_priority: "1" } });
    const next = task("a", { custom_fields: {} });
    expect(deriveTodoPatch(prev, next)).toEqual({ daily_priority: null });
  });

  it("emits the new value for a changed array custom field", () => {
    const prev = task("a", { custom_fields: { scheduled_dates: ["2026-01-01"] } });
    const next = task("a", {
      custom_fields: { scheduled_dates: ["2026-01-01", "2026-01-02"] },
    });
    expect(deriveTodoPatch(prev, next)).toEqual({
      scheduled_dates: ["2026-01-01", "2026-01-02"],
    });
  });

  it("emits top-level status and a newly added done_on together", () => {
    const prev = task("a", { status: "open" });
    const next = task("a", { status: "done", custom_fields: { done_on: "2026-02-02T00:00:00.000Z" } });
    expect(deriveTodoPatch(prev, next)).toEqual({
      status: "done",
      done_on: "2026-02-02T00:00:00.000Z",
    });
  });

  it("emits a changed title", () => {
    const prev = task("a", { title: "old" });
    const next = task("a", { title: "new" });
    expect(deriveTodoPatch(prev, next)).toEqual({ title: "new" });
  });

  it("returns an empty patch for field-identical tasks", () => {
    const prev = task("a", { custom_fields: { position: "m" } });
    const next = task("a", { custom_fields: { position: "m" } });
    expect(deriveTodoPatch(prev, next)).toEqual({});
  });

  it("ignores non-persisted fields (updated_at, subtask counts)", () => {
    const prev = task("a", { updated_at: "2026-01-01T00:00:00.000Z", subtask_count: 1 });
    const next = task("a", { updated_at: "2026-09-09T00:00:00.000Z", subtask_count: 5 });
    expect(deriveTodoPatch(prev, next)).toEqual({});
  });
});
