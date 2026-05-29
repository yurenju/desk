import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddTaskInput } from "./AddTaskInput";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";

beforeEach(() => {
  localStorage.clear();
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, recentlyDeleted: null });
});

describe("AddTaskInput", () => {
  it("adds a task on Enter and clears the field", async () => {
    const user = userEvent.setup();
    render(<AddTaskInput />);
    const input = screen.getByPlaceholderText("+ 加一件今天的事…");
    await user.type(input, "新的一件{Enter}");
    expect(useTasksStore.getState().tasks.some((t) => t.title === "新的一件")).toBe(true);
    expect(input).toHaveValue("");
  });

  it("does not add a blank task", async () => {
    const user = userEvent.setup();
    render(<AddTaskInput />);
    const before = useTasksStore.getState().tasks.length;
    await user.type(screen.getByPlaceholderText("+ 加一件今天的事…"), "   {Enter}");
    expect(useTasksStore.getState().tasks).toHaveLength(before);
  });
});
