import { describe, it, expect } from "vitest";
import type { Task } from "@/lib/types";
import { toggleDone, addTodayTask, editTitle, deleteTask, restoreTask } from "./taskOps";

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

  it("restoreTask puts the task back at its original index", () => {
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "c" })];
    const removed = { task: makeTask({ id: "b" }), index: 1 };
    const next = restoreTask(tasks, removed);
    expect(next.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
});
