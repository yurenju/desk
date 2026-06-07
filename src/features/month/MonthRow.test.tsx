import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { MonthRow } from "./MonthRow";
import { useTasksStore } from "@/store/tasks";
import * as api from "@/lib/api/todo";

it("sets monthly priority via the ring", async () => {
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  useTasksStore.setState({
    tasks: [{ id: "m7", title: "讀書", status: "open", created_at: "x", updated_at: "x",
      custom_fields: { scheduled_months: ["2026-05"] } }],
    today: "2026-05-22", status: "ready", error: null,
  });
  render(<MonthRow task={useTasksStore.getState().tasks[0]} kind="primary"
    month="2026-05" selectedDate="2026-05-22" interactive showRing />);
  await userEvent.click(screen.getByLabelText("設為本月重點"));
  await userEvent.click(await screen.findByRole("menuitemradio", { name: "① 本月第一" }));
  expect(useTasksStore.getState().tasks[0].custom_fields.monthly_priority).toBe("1");
});

it("promotes via the overflow menu", async () => {
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  useTasksStore.setState({
    tasks: [{ id: "m5", title: "讀完《Deep Work》", status: "open",
      created_at: "x", updated_at: "x", custom_fields: { scheduled_months: ["2026-05"] } }],
    today: "2026-05-22", status: "ready", error: null,
  });
  render(<MonthRow task={useTasksStore.getState().tasks[0]} kind="primary"
    month="2026-05" selectedDate="2026-05-22" interactive />);
  await userEvent.click(screen.getByLabelText("更多動作"));
  await userEvent.click(await screen.findByRole("menuitem", { name: /排到 22 日/ }));
  expect(useTasksStore.getState().tasks[0].custom_fields.scheduled_dates).toEqual(["2026-05-22"]);
});
