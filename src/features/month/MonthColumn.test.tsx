import { it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { RouterProvider, createRouter, createMemoryHistory } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { useTasksStore } from "@/store/tasks";
import { formatMonth, weekdayZh, shortDate } from "@/lib/date";

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
  localStorage.clear();
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

it("collapses completed tasks into a 已完成 group, expandable on click", async () => {
  useTasksStore.setState({
    tasks: [
      { id: "u1", title: "未完成任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], is_adhoc: "false" } },
      { id: "d1", title: "已完成任務", status: "done", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], is_adhoc: "false" } },
    ],
    today: "2099-01-15", status: "ready", error: null,
  });
  renderInRouter("/plan/2099-01-15");
  await waitFor(() => expect(screen.getByText("未完成任務")).toBeInTheDocument());

  // Done task is hidden until the group is expanded.
  expect(screen.queryByText("已完成任務")).toBeNull();
  const toggle = screen.getByRole("button", { name: /其他已完成 \(1\)/ });
  await userEvent.click(toggle);
  expect(screen.getByText("已完成任務")).toBeInTheDocument();
});

it("orders 計劃外 tasks after 計劃內 in the 其他任務 list", async () => {
  // Adhoc inserted first, planned second — the rendered order must still put
  // the planned (計劃內) row before the adhoc (計劃外) one, to keep focus on 計劃內.
  useTasksStore.setState({
    tasks: [
      { id: "a1", title: "計劃外任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], is_adhoc: "true" } },
      { id: "p1", title: "計劃內任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], is_adhoc: "false" } },
    ],
    today: "2099-01-15", status: "ready", error: null,
  });
  renderInRouter("/plan/2099-01-15");
  const planned = await screen.findByText("計劃內任務");
  const adhoc = screen.getByText("計劃外任務");
  // planned precedes adhoc in document order (DOCUMENT_POSITION_FOLLOWING === 4)
  expect(planned.compareDocumentPosition(adhoc) & 4).toBeTruthy();
});

it("collapses undone moved-away (forwarded) tasks into a 已移走 group", async () => {
  // scheduled in 2099-01 then forwarded to 2099-02 → kind 'forwarded' in January,
  // still undone → belongs in 已移走, collapsed by default.
  useTasksStore.setState({
    tasks: [
      { id: "fw", title: "已順延任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01", "2099-02"] } },
    ],
    today: "2099-01-15", status: "ready", error: null,
  });
  renderInRouter("/plan/2099-01-15");
  const toggle = await screen.findByRole("button", { name: /已移走 \(1\)/ });
  expect(screen.queryByText("已順延任務")).toBeNull();
  await userEvent.click(toggle);
  expect(screen.getByText("已順延任務")).toBeInTheDocument();
});

it("remembers a collapse group's expanded state across remount via localStorage", async () => {
  useTasksStore.setState({
    tasks: [
      { id: "fw", title: "已順延任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01", "2099-02"] } },
    ],
    today: "2099-01-15", status: "ready", error: null,
  });
  const first = renderInRouter("/plan/2099-01-15");
  await userEvent.click(await screen.findByRole("button", { name: /已移走 \(1\)/ }));
  expect(screen.getByText("已順延任務")).toBeInTheDocument();
  first.unmount();

  // Remount: the expanded state must be restored from localStorage without clicking.
  renderInRouter("/plan/2099-01-15");
  expect(await screen.findByText("已順延任務")).toBeInTheDocument();
});

it("puts a completed forwarded task into 已完成, not a loose row or 已移走", async () => {
  // Forwarded AND done → 'done wins': it goes into 已完成, never shows loose,
  // and produces no 已移走 group.
  useTasksStore.setState({
    tasks: [
      { id: "fd", title: "順延但做完", status: "done", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01", "2099-02"] } },
    ],
    today: "2099-01-15", status: "ready", error: null,
  });
  renderInRouter("/plan/2099-01-15");
  const toggle = await screen.findByRole("button", { name: /其他已完成 \(1\)/ });
  expect(screen.queryByText("順延但做完")).toBeNull();
  expect(screen.queryByRole("button", { name: /已移走/ })).toBeNull();
  await userEvent.click(toggle);
  expect(screen.getByText("順延但做完")).toBeInTheDocument();
});

it("groups a task scheduled into the viewed week under 已排入本週 with a weekday chip", async () => {
  useTasksStore.setState({
    tasks: [
      { id: "s1", title: "本週任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], scheduled_dates: ["2099-01-15"] } },
    ],
    today: "2099-01-15", status: "ready", error: null,
  });
  renderInRouter("/plan/2099-01-15");
  const monthCol = await screen.findByTestId("month-column");
  const toggle = await within(monthCol).findByRole("button", { name: /已排入本週 \(1\)/ });
  // Before expanding: task is not visible inside the month column collapse group
  expect(within(monthCol).queryByText("本週任務")).toBeNull();
  await userEvent.click(toggle);
  expect(within(monthCol).getByText("本週任務")).toBeInTheDocument();
  expect(within(monthCol).getByText(weekdayZh("2099-01-15"))).toBeInTheDocument();
});

it("keeps a done task scheduled this week in 已排入本週, not 其他已完成", async () => {
  useTasksStore.setState({
    tasks: [
      { id: "sd", title: "本週做完", status: "done", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], scheduled_dates: ["2099-01-15"] } },
    ],
    today: "2099-01-15", status: "ready", error: null,
  });
  renderInRouter("/plan/2099-01-15");
  expect(await screen.findByRole("button", { name: /已排入本週 \(1\)/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /其他已完成/ })).toBeNull();
});

it("keeps a task scheduled in another week in 其他任務 with a short-date hint", async () => {
  useTasksStore.setState({
    tasks: [
      { id: "ow", title: "別週任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], scheduled_dates: ["2099-01-28"] } },
    ],
    today: "2099-01-15", status: "ready", error: null,
  });
  renderInRouter("/plan/2099-01-15");
  expect(await screen.findByText("別週任務")).toBeInTheDocument(); // visible, not collapsed
  expect(screen.getByText(shortDate("2099-01-28"))).toBeInTheDocument(); // "1/28"
});

it("moves a task into 已排入本週 when its week is the one being viewed", async () => {
  useTasksStore.setState({
    tasks: [
      { id: "ow2", title: "別週任務", status: "open", created_at: "x", updated_at: "x",
        custom_fields: { scheduled_months: ["2099-01"], scheduled_dates: ["2099-01-28"] } },
    ],
    today: "2099-01-15", status: "ready", error: null,
  });
  renderInRouter("/plan/2099-01-28");
  expect(await screen.findByRole("button", { name: /已排入本週 \(1\)/ })).toBeInTheDocument();
});
