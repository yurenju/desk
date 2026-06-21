import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createRouter, createMemoryHistory } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { useTasksStore } from "@/store/tasks";
import { formatMonth } from "@/lib/date";

function renderInRouter(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("{}", { status: 401 }),
  );
  useTasksStore.setState({ tasks: [], today: "2099-01-15", status: "ready", error: null });
});

it("shows empty-state when month has no tasks", async () => {
  renderInRouter("/plan/2099-01-15");
  await waitFor(() =>
    expect(screen.getByText("這個月還沒有任務")).toBeInTheDocument(),
  );
});

it("renders the month title via formatMonth", async () => {
  renderInRouter("/plan/2099-01-15");
  await waitFor(() =>
    expect(screen.getByText(formatMonth("2099-01"))).toBeInTheDocument(),
  );
});

it("renders prev/next stepper links", async () => {
  renderInRouter("/plan/2099-01-15");
  await waitFor(() => {
    expect(screen.getByRole("link", { name: "上個月" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下個月" })).toBeInTheDocument();
  });
});

it("merges 計劃內 and 計劃外 into a single 其他任務 list", async () => {
  useTasksStore.setState({
    tasks: [
      { id: "p1", title: "計劃內任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], is_adhoc: "false" } },
      { id: "p2", title: "計劃外任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], is_adhoc: "true" } },
    ],
    today: "2099-01-15", status: "ready", error: null,
  });
  renderInRouter("/plan/2099-01-15");
  await waitFor(() => expect(screen.getByText("其他任務")).toBeInTheDocument());
  expect(screen.getByText("計劃內任務")).toBeInTheDocument();
  expect(screen.getByText("計劃外任務")).toBeInTheDocument();
  expect(screen.getByText("+ 計劃外")).toBeInTheDocument();
  expect(screen.queryByText("其他計劃內")).toBeNull();
});
