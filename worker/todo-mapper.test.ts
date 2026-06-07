import { describe, it, expect } from "vitest";
import { mapTodoToTask } from "./todo-mapper";

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
    expect(task).toEqual({
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
