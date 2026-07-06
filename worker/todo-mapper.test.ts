import { describe, it, expect } from "vitest";
import { mapTodoToTask, mapTodoToSubtask, mapComment } from "./todo-mapper";

describe("mapTodoToTask", () => {
  it("converts epoch-ms timestamps to ISO and flattens custom_fields", () => {
    const task = mapTodoToTask({
      id: "tod_1",
      status: "open",
      title: "Buy milk",
      created_at: 1748736000000,
      updated_at: 1748736000000,
      custom_fields: {
        scheduled_dates: ["2026-05-31"],
        daily_priority: "1",
        is_adhoc: "true",
      },
    });
    expect(task).toMatchObject({
      id: "tod_1",
      title: "Buy milk",
      status: "open",
      created_at: "2025-06-01T00:00:00.000Z",
      updated_at: "2025-06-01T00:00:00.000Z",
      custom_fields: {
        scheduled_dates: ["2026-05-31"],
        daily_priority: "1",
        is_adhoc: "true",
      },
    });
  });

  it("defaults missing custom_fields to empty object", () => {
    const task = mapTodoToTask({
      id: "tod_2",
      status: "done",
      title: "x",
      created_at: 0,
      updated_at: 0,
    });
    expect(task.custom_fields).toEqual({});
  });
});

describe("mapTodoToTask detail fields", () => {
  it("carries description and maps child_count to subtask_count", () => {
    const out = mapTodoToTask({
      id: "tod_1", status: "open", title: "A", created_at: 0, updated_at: 0,
      description: "**hi**", child_count: 3, custom_fields: {},
    });
    expect(out.description).toBe("**hi**");
    expect(out.subtask_count).toBe(3);
  });

  it("defaults subtask_count to 0 and drops empty description", () => {
    const out = mapTodoToTask({
      id: "tod_2", status: "open", title: "B", created_at: 0, updated_at: 0,
      description: "", custom_fields: {},
    });
    expect(out.subtask_count).toBe(0);
    expect(out.description).toBeUndefined();
  });
});

describe("mapTodoToTask recurring occurrences", () => {
  it("synthesizes scheduled_dates from recurrence_occurrence_at when none exist", () => {
    const task = mapTodoToTask({
      id: "tod_r1",
      status: "open",
      title: "每日例行",
      created_at: 0,
      updated_at: 0,
      recurring_template_id: "tpl_1",
      recurrence_occurrence_at: "2026-06-10",
      due_at: "2026-06-10",
    });
    expect(task.custom_fields.scheduled_dates).toEqual(["2026-06-10"]);
    expect(task.recurring).toBe(true);
  });

  it("does not override existing scheduled_dates (user already moved it)", () => {
    const task = mapTodoToTask({
      id: "tod_r2",
      status: "open",
      title: "每日例行",
      created_at: 0,
      updated_at: 0,
      recurring_template_id: "tpl_1",
      recurrence_occurrence_at: "2026-06-10",
      custom_fields: { scheduled_dates: ["2026-06-12"] },
    });
    expect(task.custom_fields.scheduled_dates).toEqual(["2026-06-12"]);
    expect(task.recurring).toBe(true);
  });

  it("leaves a plain due_at todo (no recurrence) in backlog", () => {
    const task = mapTodoToTask({
      id: "tod_d1",
      status: "open",
      title: "寫自己的 todo app",
      created_at: 0,
      updated_at: 0,
      due_at: "2026-05-24",
    });
    expect(task.custom_fields.scheduled_dates).toBeUndefined();
    expect(task.recurring).toBeFalsy();
  });
});

describe("mapTodoToSubtask", () => {
  it("projects a child todo to a lean subtask", () => {
    const out = mapTodoToSubtask({
      id: "c1", status: "done", title: "step", created_at: 0, updated_at: 0, custom_fields: {},
    });
    expect(out).toEqual({ id: "c1", title: "step", status: "done" });
  });
});

describe("mapComment", () => {
  it("keeps only content and ISO timestamps, dropping user/org/todo ids", () => {
    const out = mapComment({
      id: "cm1",
      todo_id: "t1",
      user_id: "u1",
      org_id: "o1",
      content: "note",
      created_at: 1751846400000,
      updated_at: 1751932800000,
    });
    expect(out).toEqual({
      id: "cm1",
      content: "note",
      created_at: new Date(1751846400000).toISOString(),
      updated_at: new Date(1751932800000).toISOString(),
    });
  });
});
