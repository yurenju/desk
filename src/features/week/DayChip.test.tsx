import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { RouterProvider, createRouter, createMemoryHistory } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { useTasksStore } from "@/store/tasks";

const TODAY = "2026-06-11";

function renderAt(path: string, today = TODAY) {
  useTasksStore.setState({ tasks: [], today, status: "ready", error: null });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  return { router };
}

async function chips() {
  return (await screen.findByRole("navigation", { name: "日期切換" })) as HTMLElement;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));
});

it("links each chip to /focus/$date with aria-current on the selected day", async () => {
  renderAt("/focus/2026-06-10");
  const nav = await chips();
  const link = within(nav).getByRole("link", { name: "切到 2026-06-10" });
  expect(link.getAttribute("href")).toBe("/focus/2026-06-10");
  expect(link.getAttribute("aria-current")).toBe("page");
});

it("mobile week arrows page the chips a week without moving the focus day", async () => {
  const { router } = renderAt("/focus/2026-06-10");
  const nav = await chips();

  fireEvent.click(within(nav).getByRole("button", { name: "上一週" }));
  expect(within(nav).getByRole("link", { name: "切到 2026-06-03" })).toBeInTheDocument();
  expect(within(nav).queryByRole("link", { name: "切到 2026-06-10" })).toBeNull();
  expect(router.state.location.pathname).toBe("/focus/2026-06-10");

  // Two clicks forward lands on the week after the starting one.
  fireEvent.click(within(nav).getByRole("button", { name: "下一週" }));
  fireEvent.click(within(nav).getByRole("button", { name: "下一週" }));
  expect(within(nav).getByRole("link", { name: "切到 2026-06-17" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/focus/2026-06-10");
});
