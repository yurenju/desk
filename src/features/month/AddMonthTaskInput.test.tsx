import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import { AddMonthTaskInput } from "./AddMonthTaskInput";
import { useTasksStore } from "@/store/tasks";
import * as api from "@/lib/api/todo";

it("adds a month-scoped task on Enter", async () => {
  vi.spyOn(api, "postTodo").mockResolvedValue({
    id: "srv", title: "規劃", status: "open", created_at: "x", updated_at: "x",
    custom_fields: { scheduled_months: ["2026-05"], is_adhoc: "false" },
  });
  useTasksStore.setState({ tasks: [], status: "ready", error: null });
  render(<AddMonthTaskInput month="2026-05" />);
  const input = screen.getByLabelText("新增本月任務");
  await userEvent.type(input, "規劃{Enter}");
  expect(useTasksStore.getState().tasks.some(
    (t) => t.custom_fields.scheduled_months?.includes("2026-05"))).toBe(true);
});
