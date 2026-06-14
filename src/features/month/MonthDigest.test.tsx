import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { MonthDigest } from "./MonthDigest";
import type { Task } from "@/lib/types";

// Render MonthDigest inside a minimal TanStack Router context so the
// <Link to="/plan/$date"> it renders can resolve without throwing.
function renderWithRouter(ui: React.ReactElement) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        {ui}
        <Outlet />
      </>
    ),
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => null,
  });
  const planRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/plan/$date",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, planRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

function makeTask(overrides: Partial<Task> & { id: string; title: string }): Task {
  return {
    status: "open",
    created_at: "x",
    updated_at: "x",
    custom_fields: {},
    ...overrides,
  };
}

it("renders progress and top-3 but not the 其他 list, plus an edit link", async () => {
  const top3Task = makeTask({
    id: "t1",
    title: "月度重點任務",
    custom_fields: { scheduled_months: ["2026-06"], monthly_priority: "1" },
  });
  const otherTask = makeTask({
    id: "t2",
    title: "其他月度任務",
    custom_fields: { scheduled_months: ["2026-06"] },
  });

  renderWithRouter(
    <MonthDigest
      allTasks={[top3Task, otherTask]}
      month="2026-06"
      today="2026-06-14"
      selectedDate="2026-06-14"
    />,
  );

  // Top-3 section should be present
  expect(await screen.findByText("本月三件大事")).toBeInTheDocument();

  // The 其他 list should NOT appear
  expect(screen.queryByText(/^其他 \(/)).not.toBeInTheDocument();

  // The non-priority task's title should NOT be shown (hidden, not just the header)
  expect(screen.queryByText("其他月度任務")).not.toBeInTheDocument();

  // The progress label should count BOTH primary tasks (including the hidden one)
  expect(screen.getByText(/計劃內已完成 0\/2/)).toBeInTheDocument();

  // An edit link pointing to /plan/$date should be present
  const link = screen.getByRole("link", { name: /在計畫頁編輯本月/ });
  expect(link).toHaveAttribute("href", expect.stringContaining("/plan/2026-06-14"));
});
