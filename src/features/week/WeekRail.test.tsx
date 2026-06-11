import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
  return render(<RouterProvider router={router} />);
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

it("prev/next week links shift the selected date by 7 days", async () => {
  renderAt("/focus/2026-06-10");
  const r = await rail();
  expect(within(r).getByRole("link", { name: "上一週" }).getAttribute("href")).toBe(
    "/focus/2026-06-03",
  );
  expect(within(r).getByRole("link", { name: "下一週" }).getAttribute("href")).toBe(
    "/focus/2026-06-17",
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
