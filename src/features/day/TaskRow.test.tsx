import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskRow } from "./TaskRow";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";
import * as api from "@/lib/api/todo";
import type { Task } from "@/lib/types";
import { currentMonthISO } from "@/lib/date";
import { dailyRankOn } from "@/lib/tasks";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, status: "ready", error: null });
});

function rowFor(id: string) {
  const task = useTasksStore.getState().tasks.find((t) => t.id === id)!;
  return <TaskRow task={task} kind="primary" date={useTasksStore.getState().today} interactive />;
}

describe("TaskRow (interactive)", () => {
  it("toggles done when the checkbox is clicked", async () => {
    const user = userEvent.setup();
    render(rowFor("d5"));
    await user.click(screen.getByRole("checkbox"));
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")!.status).toBe("done");
  });

  it("deletes when the trash button is clicked", async () => {
    const user = userEvent.setup();
    render(rowFor("d5"));
    await user.click(screen.getByLabelText("更多動作"));
    await user.click(await screen.findByRole("menuitem", { name: "刪除" }));
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")).toBeUndefined();
  });

  it("edits the title via the edit button + Enter", async () => {
    const user = userEvent.setup();
    render(rowFor("d5"));
    await user.click(screen.getByLabelText("更多動作"));
    await user.click(await screen.findByRole("menuitem", { name: "編輯" }));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "新內容{Enter}");
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")!.title).toBe("新內容");
  });

  it("moves an adhoc task to planned via the overflow menu", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    await useTasksStore.getState().setAdhoc("d5", true);
    render(rowFor("d5"));
    await user.click(screen.getByLabelText("更多動作"));
    await user.click(await screen.findByRole("menuitem", { name: /移到計畫內/ }));
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.is_adhoc,
    ).toBe("false");
  });

  it("marks a planned task as unplanned via the overflow menu", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    await useTasksStore.getState().setAdhoc("d5", false);
    render(rowFor("d5"));
    await user.click(screen.getByLabelText("更多動作"));
    await user.click(await screen.findByRole("menuitem", { name: /標為計畫外/ }));
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.is_adhoc,
    ).toBe("true");
  });

  it("is read-only when interactive is false", () => {
    const task = useTasksStore.getState().tasks.find((t) => t.id === "d5")!;
    render(
      <TaskRow
        task={task}
        kind="primary"
        date={useTasksStore.getState().today}
        interactive={false}
      />,
    );
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.queryByLabelText("刪除")).toBeNull();
  });

  it("opens a priority menu and sets the chosen slot", async () => {
    const user = userEvent.setup();
    const TestComponent = () => {
      const task = useTasksStore((s) => s.tasks.find((t) => t.id === "d5"))!;
      return (
        <TaskRow
          task={task}
          kind="primary"
          date={useTasksStore.getState().today}
          interactive
          showRing
        />
      );
    };
    await useTasksStore.getState().setDailyPriority("d1", null, useTasksStore.getState().today);
    await useTasksStore.getState().setDailyPriority("d2", null, useTasksStore.getState().today);
    await useTasksStore.getState().setDailyPriority("d3", null, useTasksStore.getState().today);
    render(<TestComponent />);
    await user.click(screen.getByRole("button", { name: "設為今日重點" }));
    await user.click(await screen.findByRole("menuitemradio", { name: /今日第一/ }));
    expect(
      dailyRankOn(
        useTasksStore.getState().tasks.find((t) => t.id === "d5")!,
        useTasksStore.getState().today,
      ),
    ).toBe("1");
  });
});

describe("TaskRow recurring marker", () => {
  function recurringTask(): Task {
    return {
      id: "r1",
      title: "每日例行",
      status: "open",
      created_at: "x",
      updated_at: "x",
      custom_fields: { scheduled_dates: ["2026-06-10"] },
      recurring: true,
    };
  }

  it("shows a ↻ marker for a recurring task", () => {
    render(<TaskRow task={recurringTask()} kind="primary" date="2026-06-10" />);
    expect(screen.getByLabelText("重複任務")).toBeInTheDocument();
  });

  it("shows no ↻ marker for a non-recurring task", () => {
    render(rowFor("d5"));
    expect(screen.queryByLabelText("重複任務")).not.toBeInTheDocument();
  });
});

describe("TaskRow carryover actions", () => {
  const PAST = "2026-05-20";
  function seed(task: Task) {
    useTasksStore.setState({ tasks: [task], today: MOCK_TODAY, status: "ready", error: null });
  }
  const pastTask = (): Task => ({
    id: "p1", title: "順延我", status: "open", created_at: "x", updated_at: "x",
    custom_fields: { scheduled_dates: [PAST], is_adhoc: "false" },
  });

  it("offers 移到今天 on a past day and forwards the task to today", async () => {
    const user = userEvent.setup();
    seed(pastTask());
    render(<TaskRow task={useTasksStore.getState().tasks[0]} kind="primary" date={PAST} interactive />);
    await user.click(screen.getByLabelText("更多動作"));
    await user.click(await screen.findByRole("menuitem", { name: /移到今天/ }));
    const t = useTasksStore.getState().tasks.find((x) => x.id === "p1")!;
    expect(t.custom_fields.scheduled_dates).toEqual([PAST, MOCK_TODAY]);
  });

  it("hides 移到今天 when viewing today", async () => {
    const user = userEvent.setup();
    seed({ ...pastTask(), custom_fields: { scheduled_dates: [MOCK_TODAY] } });
    render(<TaskRow task={useTasksStore.getState().tasks[0]} kind="primary" date={MOCK_TODAY} interactive />);
    await user.click(screen.getByLabelText("更多動作"));
    expect(screen.queryByRole("menuitem", { name: /移到今天/ })).toBeNull();
  });

  it("demotes a task back to the current month via 丟回月度", async () => {
    const user = userEvent.setup();
    seed(pastTask());
    render(<TaskRow task={useTasksStore.getState().tasks[0]} kind="primary" date={PAST} interactive />);
    await user.click(screen.getByLabelText("更多動作"));
    await user.click(await screen.findByRole("menuitem", { name: /丟回月度/ }));
    const t = useTasksStore.getState().tasks.find((x) => x.id === "p1")!;
    expect(t.custom_fields.unscheduled_at).toBe(PAST);
    expect(t.custom_fields.scheduled_months).toEqual([
      currentMonthISO(new Date(MOCK_TODAY + "T00:00:00")),
    ]);
  });

  it("renders a dismissed trail row with its destination month", () => {
    render(
      <TaskRow
        task={{
          id: "d1", title: "已退回", status: "open", created_at: "x", updated_at: "x",
          custom_fields: { scheduled_dates: [PAST], unscheduled_at: PAST, scheduled_months: ["2026-05"] },
        }}
        kind="dismissed"
        date={PAST}
      />,
    );
    expect(screen.getByText("↩ 已退回本月")).toBeInTheDocument();
  });

  it("renders a forwarded trail row with its destination day", () => {
    render(
      <TaskRow
        task={{
          id: "f1", title: "已移走", status: "open", created_at: "x", updated_at: "x",
          custom_fields: { scheduled_dates: [PAST, MOCK_TODAY] },
        }}
        kind="forwarded"
        date={PAST}
      />,
    );
    expect(screen.getByText("↪ 已移到今天")).toBeInTheDocument();
  });

  it("a forwarded trail row is checkable but has no overflow menu", () => {
    render(
      <TaskRow
        task={{
          id: "f1", title: "已順延", status: "open", created_at: "x", updated_at: "x",
          custom_fields: { scheduled_dates: [PAST, MOCK_TODAY] },
        }}
        kind="forwarded"
        date={PAST}
        interactive
      />,
    );
    expect(screen.getByRole("checkbox")).not.toBeDisabled();
    expect(screen.queryByRole("button", { name: "更多動作" })).not.toBeInTheDocument();
  });

  it("a dismissed trail row is checkable", () => {
    render(
      <TaskRow
        task={{
          id: "d2", title: "已退回", status: "open", created_at: "x", updated_at: "x",
          custom_fields: { scheduled_dates: [PAST], unscheduled_at: PAST },
        }}
        kind="dismissed"
        date={PAST}
        interactive
      />,
    );
    expect(screen.getByRole("checkbox")).not.toBeDisabled();
  });
});
