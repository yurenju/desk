import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Top3Card } from "./Top3Card";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";
import { tasksOnDate, dailyRankOn } from "@/lib/tasks";
import * as api from "@/lib/api/todo";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, status: "ready", error: null });
});

const TestComponent = ({ interactive = true }: { interactive?: boolean }) => {
  const tasks = useTasksStore((s) => s.tasks);
  const today = useTasksStore.getState().today;
  const entries = tasksOnDate(tasks, today).filter((e) => e.task.id === "d1");
  return (
    <Top3Card entries={entries} title="今天最重要的三件事" date={today} interactive={interactive} />
  );
};

describe("Top3Card (interactive)", () => {
  it("toggles done for a top-3 task", async () => {
    const user = userEvent.setup();
    render(<TestComponent />);
    await user.click(screen.getByRole("checkbox"));
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d1")!.status).toBe("done");
  });

  it("stays read-only when interactive is false", () => {
    render(<TestComponent interactive={false} />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.queryByLabelText("更多動作")).toBeNull();
  });

  it("edits the title via the overflow menu and Enter key", async () => {
    const user = userEvent.setup();
    render(<TestComponent />);

    await user.click(screen.getByLabelText("更多動作"));
    await user.click(await screen.findByRole("menuitem", { name: "編輯" }));

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "自定義重點{Enter}");

    expect(useTasksStore.getState().tasks.find((t) => t.id === "d1")!.title).toBe("自定義重點");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("自定義重點")).toBeDefined();
  });

  it("cancels title edits on Escape key", async () => {
    const user = userEvent.setup();
    render(<TestComponent />);

    await user.click(screen.getByLabelText("更多動作"));
    await user.click(await screen.findByRole("menuitem", { name: "編輯" }));

    const input = screen.getByRole("textbox");
    await user.type(input, "修改中...{Escape}");

    expect(useTasksStore.getState().tasks.find((t) => t.id === "d1")!.title).toBe(
      "完成 desk.yurenju.me todo MVP demo",
    );
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("deletes a task via the overflow menu", async () => {
    const user = userEvent.setup();
    render(<TestComponent />);

    await user.click(screen.getByLabelText("更多動作"));
    await user.click(await screen.findByRole("menuitem", { name: "刪除" }));

    expect(useTasksStore.getState().tasks.find((t) => t.id === "d1")).toBeUndefined();
  });

  it("shows the unplanned chip for a same-day adhoc top-3 task", async () => {
    // Rule: chip only when adhoc AND created today AND scheduled only for today.
    useTasksStore.setState((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === "d1"
          ? {
              ...t,
              created_at: `${MOCK_TODAY}T09:00:00Z`,
              custom_fields: { ...t.custom_fields, is_adhoc: "true" as const },
            }
          : t,
      ),
    }));
    render(<TestComponent />);
    expect(screen.getByText(/計劃外/)).toBeInTheDocument();
  });

  it("hides the unplanned chip for a planned top-3 task", async () => {
    await useTasksStore.getState().setAdhoc("d1", false);
    render(<TestComponent />);
    expect(screen.queryByText(/計劃外/)).toBeNull();
  });

  it("hides the unplanned chip for an adhoc task not created today", async () => {
    // d1's fixture created_at is 2026-05-01, before today → no chip even when adhoc.
    await useTasksStore.getState().setAdhoc("d1", true);
    render(<TestComponent />);
    expect(screen.queryByText(/計劃外/)).toBeNull();
  });

  it("toggles a top-3 task to unplanned via the overflow menu", async () => {
    const user = userEvent.setup();
    await useTasksStore.getState().setAdhoc("d1", false);
    render(<TestComponent />);

    await user.click(screen.getByLabelText("更多動作"));
    await user.click(await screen.findByRole("menuitem", { name: /標為計畫外/ }));

    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d1")!.custom_fields.is_adhoc,
    ).toBe("true");
  });

  it("demotes a top-3 task back to the month via the overflow menu", async () => {
    const user = userEvent.setup();
    render(<TestComponent />);

    await user.click(screen.getByLabelText("更多動作"));
    await user.click(await screen.findByRole("menuitem", { name: /丟回月度/ }));

    const task = useTasksStore.getState().tasks.find((t) => t.id === "d1")!;
    // daily_priority is kept on purpose so the dismissed row stays in its Top3
    // slot (greyed). It's the unscheduled_at stamp that removes it from "primary".
    expect(task.custom_fields.daily_priority).toBe("1");
    expect(task.custom_fields.unscheduled_at).toBe(MOCK_TODAY);
  });

  it("hides 移到今天 for a top-3 task already on today", async () => {
    const user = userEvent.setup();
    render(<TestComponent />);

    await user.click(screen.getByLabelText("更多動作"));
    expect(screen.queryByRole("menuitem", { name: /移到今天/ })).toBeNull();
  });

  it("moves a carryover top-3 task to today via the overflow menu", async () => {
    const user = userEvent.setup();
    const carryoverDate = "2026-05-21";
    const Carryover = () => {
      const tasks = useTasksStore((s) => s.tasks);
      const entries = tasksOnDate(tasks, carryoverDate).filter((e) => e.task.id === "w-thu");
      return (
        <Top3Card entries={entries} title="最重要的三件事" date={carryoverDate} interactive />
      );
    };
    render(<Carryover />);

    await user.click(screen.getByLabelText("更多動作"));
    await user.click(await screen.findByRole("menuitem", { name: /移到今天/ }));

    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "w-thu")!.custom_fields.scheduled_dates,
    ).toContain(MOCK_TODAY);
  });

  it("opens a priority menu and sets the chosen slot", async () => {
    const user = userEvent.setup();
    render(<TestComponent />);

    await user.click(screen.getByRole("button", { name: "今日重點第 1" }));
    await user.click(await screen.findByRole("menuitemradio", { name: /今日第二/ }));

    expect(
      dailyRankOn(useTasksStore.getState().tasks.find((t) => t.id === "d1")!, MOCK_TODAY),
    ).toBe("2");
  });
});
