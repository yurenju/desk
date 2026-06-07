import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createRouter, createMemoryHistory } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("{}", { status: 401 }),
  );
});

it("opens the plan at the given focus date and renders that month's tasks", async () => {
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, status: "ready", error: null });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/plan/2026-05-15"] }),
  });
  render(<RouterProvider router={router} />);
  await waitFor(() =>
    expect(screen.getByText("推出 desk.yurenju.me MVP")).toBeInTheDocument(),
  );
});

it("redirects an invalid focus date back to /plan", async () => {
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, status: "ready", error: null });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/plan/garbage"] }),
  });
  render(<RouterProvider router={router} />);
  await waitFor(() => expect(router.state.location.pathname).toBe("/plan"));
});
