import { describe, it, expect } from "vitest";
import type { Task } from "@/lib/types";
import { toggleDone } from "./taskOps";

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
    const tasks = [
      makeTask({ id: "a", status: "done", custom_fields: { done_on: NOW } }),
    ];
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

