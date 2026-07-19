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

async function rail() {
  return (await screen.findByRole("navigation", { name: "週導覽" })) as HTMLElement;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));
});

it("links each day in the week to /focus/$date", async () => {
  renderAt("/focus/2026-06-10");
  const r = await rail();
  expect(within(r).getByRole("link", { name: "切到 2026-06-09" }).getAttribute("href")).toBe(
    "/focus/2026-06-09",
  );
});

it("marks the selected day as the current page", async () => {
  renderAt("/focus/2026-06-10");
  const r = await rail();
  expect(within(r).getByRole("link", { name: "切到 2026-06-10" }).getAttribute("aria-current")).toBe(
    "page",
  );
});

it("shows 回今天 pointing at today when viewing another day", async () => {
  renderAt("/focus/2026-06-10");
  const r = await rail();
  expect(within(r).getByRole("link", { name: "回今天" }).getAttribute("href")).toBe(
    "/focus/2026-06-11",
  );
});

it("hides 回今天 when viewing today", async () => {
  renderAt("/focus/2026-06-11");
  const r = await rail();
  expect(within(r).queryByRole("link", { name: "回今天" })).toBeNull();
});

// ─── Decoupled week view (focus day vs week view) ────────────────────────────

it("prev-week arrow pages the rail only, leaving the focus day and URL untouched", async () => {
  const { router } = renderAt("/focus/2026-06-10");
  const r = await rail();
  // The center hero shows the focus day.
  expect(screen.getByRole("heading", { name: "Jun 10" })).toBeInTheDocument();

  fireEvent.click(within(r).getByRole("button", { name: "上一週" }));

  // Rail moved to the previous week…
  expect(within(r).getByRole("link", { name: "切到 2026-06-03" })).toBeInTheDocument();
  expect(within(r).queryByRole("link", { name: "切到 2026-06-10" })).toBeNull();
  // …but the focus day and the route did not move.
  expect(screen.getByRole("heading", { name: "Jun 10" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/focus/2026-06-10");
});

it("shows 回今天 once the rail is paged away even while the focus day is today", async () => {
  const { router } = renderAt("/focus/2026-06-11"); // focus day == today
  const r = await rail();
  expect(within(r).queryByRole("link", { name: "回今天" })).toBeNull();

  fireEvent.click(within(r).getByRole("button", { name: "上一週" }));

  // Rail is off today's week, so the reset escape hatch appears.
  const back = within(r).getByRole("link", { name: "回今天" });
  fireEvent.click(back);

  // Rail snaps back to today's week; focus day (already today) and URL stay put.
  expect(within(r).getByRole("link", { name: "切到 2026-06-11" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/focus/2026-06-11");
});

it("snaps the rail back to the focus day's week when the focus day changes", async () => {
  const { router } = renderAt("/focus/2026-06-10");
  const r = await rail();
  fireEvent.click(within(r).getByRole("button", { name: "上一週" }));
  expect(within(r).queryByRole("link", { name: "切到 2026-06-10" })).toBeNull();

  // Navigating the focus day (回今天 → today) re-syncs the rail to that week.
  fireEvent.click(within(r).getByRole("link", { name: "回今天" }));

  expect(router.state.location.pathname).toBe("/focus/2026-06-11");
  expect(within(r).getByRole("link", { name: "切到 2026-06-11" })).toBeInTheDocument();
});

it("mobile chip arrows page the week without navigating the focus day", async () => {
  const { router } = renderAt("/focus/2026-06-10");
  const nav = (await screen.findByRole("navigation", { name: "日期切換" })) as HTMLElement;

  fireEvent.click(within(nav).getByRole("button", { name: "上一週" }));

  expect(within(nav).getByRole("link", { name: "切到 2026-06-03" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/focus/2026-06-10");
});
