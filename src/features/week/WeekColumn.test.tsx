import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import { RouterProvider, createRouter, createMemoryHistory } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { useTasksStore } from "@/store/tasks";
import type { Task } from "@/lib/types";

const FOCUS = "2099-01-15";

function task(id: string, cf: Task["custom_fields"]): Task {
  return { id, title: id, status: "open", created_at: "x", updated_at: "x", custom_fields: cf };
}

function renderWithTasks(tasks: Task[]) {
  useTasksStore.setState({ tasks, today: FOCUS, status: "ready", error: null });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [`/plan/${FOCUS}`] }),
  });
  return render(<RouterProvider router={router} />);
}

async function focusCell() {
  return (await screen.findByLabelText(`切到 ${FOCUS}`)) as HTMLElement;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));
});

it("shows '還有 n 件其他任務' for the day's non-priority tasks", async () => {
  renderWithTasks([
    task("p1", { scheduled_dates: [FOCUS], daily_priority: "1" }),
    task("o1", { scheduled_dates: [FOCUS], is_adhoc: "false" }),
    task("o2", { scheduled_dates: [FOCUS], is_adhoc: "true" }),
  ]);
  const cell = await focusCell();
  await waitFor(() =>
    expect(within(cell).getByText("還有 2 件其他任務")).toBeInTheDocument(),
  );
});

it("suppresses the '—' placeholder when a day has only other tasks", async () => {
  renderWithTasks([
    task("o1", { scheduled_dates: [FOCUS], is_adhoc: "false" }),
    task("o2", { scheduled_dates: [FOCUS], is_adhoc: "false" }),
  ]);
  const cell = await focusCell();
  await waitFor(() =>
    expect(within(cell).getByText("還有 2 件其他任務")).toBeInTheDocument(),
  );
  expect(within(cell).queryByText("—")).not.toBeInTheDocument();
});

it("shows no count line when a day has only top-3 tasks", async () => {
  renderWithTasks([
    task("p1", { scheduled_dates: [FOCUS], daily_priority: "1" }),
    task("p2", { scheduled_dates: [FOCUS], daily_priority: "2" }),
  ]);
  const cell = await focusCell();
  await waitFor(() => expect(within(cell).getByText("p1")).toBeInTheDocument());
  expect(within(cell).queryByText(/還有/)).not.toBeInTheDocument();
});

it("shows '—' and no count line for an empty day", async () => {
  renderWithTasks([]);
  const cell = await focusCell();
  await waitFor(() => expect(within(cell).getByText("—")).toBeInTheDocument());
  expect(within(cell).queryByText(/還有/)).not.toBeInTheDocument();
});
