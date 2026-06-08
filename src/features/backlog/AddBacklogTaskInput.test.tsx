import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import { AddBacklogTaskInput } from "./AddBacklogTaskInput";
import { useTasksStore } from "@/store/tasks";
import * as api from "@/lib/api/todo";

it("adds a backlog task on Enter", async () => {
  vi.spyOn(api, "postTodo").mockResolvedValue({
    id: "srv", title: "someday", status: "open", created_at: "x", updated_at: "x",
    custom_fields: { scheduled_months: [], scheduled_dates: [], is_adhoc: "false" },
  });
  useTasksStore.setState({ tasks: [], status: "ready", error: null });
  render(<AddBacklogTaskInput />);
  const input = screen.getByLabelText("新增 backlog 任務");
  await userEvent.type(input, "someday{Enter}");
  expect(useTasksStore.getState().tasks.some((t) => t.title === "someday")).toBe(true);
});
