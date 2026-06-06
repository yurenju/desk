import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskRow } from "./TaskRow";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";
import * as api from "@/lib/api/todo";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, status: "ready", error: null });
});

function rowFor(id: string) {
  const task = useTasksStore.getState().tasks.find((t) => t.id === id)!;
  return <TaskRow task={task} kind="primary" interactive />;
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
    render(<TaskRow task={task} kind="primary" interactive={false} />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.queryByLabelText("刪除")).toBeNull();
  });

  it("opens a priority menu and sets the chosen slot", async () => {
    const user = userEvent.setup();
    const TestComponent = () => {
      const task = useTasksStore((s) => s.tasks.find((t) => t.id === "d5"))!;
      return <TaskRow task={task} kind="primary" interactive showRing />;
    };
    await useTasksStore.getState().setDailyPriority("d1", null);
    await useTasksStore.getState().setDailyPriority("d2", null);
    await useTasksStore.getState().setDailyPriority("d3", null);
    render(<TestComponent />);
    await user.click(screen.getByRole("button", { name: "設為今日重點" }));
    await user.click(await screen.findByRole("menuitemradio", { name: /今日第一/ }));
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority,
    ).toBe("1");
  });
});
