import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import { MonthHeroCard } from "./MonthHeroCard";
import { useTasksStore } from "@/store/tasks";
import * as api from "@/lib/api/todo";

it("sets monthly priority via the ring menu and evicts the collider", async () => {
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  useTasksStore.setState({
    tasks: [
      { id: "a", title: "甲", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2026-05"], monthly_priority: "1" } },
      { id: "b", title: "乙", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2026-05"], monthly_priority: "2" } },
    ],
    today: "2026-05-22", status: "ready", error: null,
  });
  const top3 = useTasksStore.getState().tasks;
  render(<MonthHeroCard top3={top3} month="2026-05" selectedDate="2026-05-22" />);
  // open task 乙's priority ring (the one currently showing "2")
  await userEvent.click(screen.getByLabelText("本月重點第 2"));
  await userEvent.click(await screen.findByRole("menuitemradio", { name: "① 本月第一" }));
  const s = useTasksStore.getState();
  expect(s.tasks.find((t) => t.id === "b")!.custom_fields.monthly_priority).toBe("1");
  expect(s.tasks.find((t) => t.id === "a")!.custom_fields.monthly_priority).toBeUndefined();
});
