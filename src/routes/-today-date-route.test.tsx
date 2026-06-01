import { it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
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
    status: "ready",
    error: null,
  });
});

// Regression guard: /today/$date is a child of /today in the generated route
// tree. If the /today route renders its own view instead of <Outlet/>, the
// child date route is shadowed and the selected date is ignored.
it("loads the date from /today/$date instead of today", async () => {
  const spy = vi.spyOn(api, "fetchTodos").mockResolvedValue([]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/today/2026-05-30"] }),
  });
  render(<RouterProvider router={router} />);
  await waitFor(() => expect(spy).toHaveBeenCalledWith("2026-05-30"));
});
