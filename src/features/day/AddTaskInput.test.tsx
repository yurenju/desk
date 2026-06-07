import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddTaskInput } from "./AddTaskInput";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";
import * as api from "@/lib/api/todo";

beforeEach(() => {
  vi.restoreAllMocks();
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, status: "ready", error: null });
});

describe("AddTaskInput", () => {
  it("adds a task on Enter and clears the field", async () => {
    vi.spyOn(api, "postTodo").mockResolvedValue({
      id: "srv-new",
      title: "新的一件",
      status: "open",
      created_at: "x",
      updated_at: "x",
      custom_fields: { scheduled_dates: [MOCK_TODAY], is_adhoc: "true" },
    });
    const user = userEvent.setup();
    render(<AddTaskInput date={useTasksStore.getState().today} />);
    const input = screen.getByPlaceholderText("+ 加一件這天的事…");
    await user.type(input, "新的一件{Enter}");
    expect(useTasksStore.getState().tasks.some((t) => t.title === "新的一件")).toBe(true);
    expect(input).toHaveValue("");
  });

  it("does not add a blank task", async () => {
    const user = userEvent.setup();
    render(<AddTaskInput date={useTasksStore.getState().today} />);
    const before = useTasksStore.getState().tasks.length;
    await user.type(screen.getByPlaceholderText("+ 加一件這天的事…"), "   {Enter}");
    expect(useTasksStore.getState().tasks).toHaveLength(before);
  });
});
