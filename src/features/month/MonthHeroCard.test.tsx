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
  const taskById = new Map(top3.map((t) => [`month:${t.id}`, t]));
  render(
    <MonthHeroCard top3={top3} month="2026-05" selectedDate="2026-05-22" taskById={taskById} />,
  );
  // open task 乙's priority ring (the one currently showing "2")
  await userEvent.click(screen.getByLabelText("本月重點第 2"));
  await userEvent.click(await screen.findByRole("menuitemradio", { name: "① 本月第一" }));
  const s = useTasksStore.getState();
  expect(s.tasks.find((t) => t.id === "b")!.custom_fields.monthly_priority).toBe("1");
  // cascade: a (was rank 1) is pushed to rank 2, not evicted
  expect(s.tasks.find((t) => t.id === "a")!.custom_fields.monthly_priority).toBe("2");
});

it("promotes a hero task into the day's top-3", async () => {
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  useTasksStore.setState({
    tasks: [
      { id: "h1", title: "寫月報", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2026-05"], monthly_priority: "1" } },
    ],
    today: "2026-05-22", status: "ready", error: null,
  });
  {
    const tasks = useTasksStore.getState().tasks;
    const taskById = new Map(tasks.map((t) => [`month:${t.id}`, t]));
    render(
      <MonthHeroCard top3={tasks} month="2026-05" selectedDate="2026-05-22" taskById={taskById} />,
    );
  }
  await userEvent.click(screen.getByLabelText("更多動作"));
  await userEvent.click(await screen.findByRole("menuitem", { name: /22 日 · ② 三件事/ }));
  const t = useTasksStore.getState().tasks.find((x) => x.id === "h1")!;
  expect(t.custom_fields.scheduled_dates).toEqual(["2026-05-22"]);
  // reorderPriority compresses rank 2 → rank 1 when no prior rank-1 exists
  expect(t.custom_fields.daily_priority).toBe("1");
});
