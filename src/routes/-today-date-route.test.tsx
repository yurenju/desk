import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  RouterProvider,
  createRouter,
  createMemoryHistory,
} from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import * as api from "@/lib/api/todo";
import { useTasksStore } from "@/store/tasks";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("{}", { status: 401 }),
  );
  useTasksStore.setState({
    tasks: [],
    today: "2026-06-01",
    status: "idle",
    error: null,
  });
});

// Regression guard: /today/$date is a child of /today in the generated route
// tree. If the /today route renders its own view instead of <Outlet/>, the
// child date route is shadowed and the $date param never reaches TodayView →
// TodayLayout → DayColumn(selectedDate={date}), so tasks for that specific
// date would not appear.
it("renders the /today/$date child route — $date param reaches the view", async () => {
  // A task scheduled exclusively on 2026-05-30 (not on any other date).
  // If the $date param is shadowed or ignored, DayColumn won't filter for
  // this date and the title won't be in the DOM.
  const taskOn0530 = {
    id: "date-guard-1",
    title: "僅出現在 05-30 的任務",
    status: "open" as const,
    created_at: "x",
    updated_at: "x",
    custom_fields: { scheduled_dates: ["2026-05-30"] },
  };
  vi.spyOn(api, "fetchTodos").mockResolvedValue([taskOn0530]);

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/today/2026-05-30"] }),
  });
  render(<RouterProvider router={router} />);

  // The task title must appear in the rendered output for the view to correctly
  // reflect selectedDate="2026-05-30".
  await waitFor(() =>
    expect(screen.getByText("僅出現在 05-30 的任務")).toBeTruthy(),
  );
});
