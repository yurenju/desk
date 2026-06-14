import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
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

it("promotes into the day's other-planned via the overflow menu", async () => {
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  useTasksStore.setState({
    tasks: [{ id: "m5", title: "讀完《Deep Work》", status: "open",
      created_at: "x", updated_at: "x", custom_fields: { scheduled_months: ["2026-05"] } }],
    today: "2026-05-22", status: "ready", error: null,
  });
  render(<MonthRow task={useTasksStore.getState().tasks[0]} kind="primary"
    month="2026-05" selectedDate="2026-05-22" interactive />);
  await userEvent.click(screen.getByLabelText("更多動作"));
  await userEvent.click(await screen.findByRole("menuitem", { name: /22 日 · 其他/ }));
  const t = useTasksStore.getState().tasks[0];
  expect(t.custom_fields.scheduled_dates).toEqual(["2026-05-22"]);
  expect(t.custom_fields.daily_priority).toBeUndefined();
});

it("promotes into the day's top-3 via the overflow menu", async () => {
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  useTasksStore.setState({
    tasks: [{ id: "m9", title: "排版", status: "open", created_at: "x", updated_at: "x",
      custom_fields: { scheduled_months: ["2026-05"] } }],
    today: "2026-05-22", status: "ready", error: null,
  });
  render(<MonthRow task={useTasksStore.getState().tasks[0]} kind="primary"
    month="2026-05" selectedDate="2026-05-22" interactive />);
  await userEvent.click(screen.getByLabelText("更多動作"));
  await userEvent.click(await screen.findByRole("menuitem", { name: /22 日 · ① 三件事/ }));
  const t = useTasksStore.getState().tasks[0];
  expect(t.custom_fields.scheduled_dates).toEqual(["2026-05-22"]);
  expect(t.custom_fields.daily_priority).toBe("1");
});

it("month row menu includes 移到下月 and 丟回 Backlog", async () => {
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  useTasksStore.setState({
    tasks: [{ id: "m10", title: "測試任務", status: "open", created_at: "x", updated_at: "x",
      custom_fields: { scheduled_months: ["2026-05"] } }],
    today: "2026-05-22", status: "ready", error: null,
  });
  render(<MonthRow task={useTasksStore.getState().tasks[0]} kind="primary"
    month="2026-05" selectedDate="2026-05-22" interactive />);
  await userEvent.click(screen.getByLabelText("更多動作"));
  expect(await screen.findByText("↪ 移到下月")).toBeInTheDocument();
  expect(screen.getByText("↩ 丟回 Backlog")).toBeInTheDocument();
});
