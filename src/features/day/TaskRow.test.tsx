import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskRow } from "./TaskRow";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";

beforeEach(() => {
  localStorage.clear();
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, recentlyDeleted: null });
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
    await user.click(screen.getByLabelText("刪除"));
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")).toBeUndefined();
  });

  it("edits the title via the edit button + Enter", async () => {
    const user = userEvent.setup();
    render(rowFor("d5"));
    await user.click(screen.getByLabelText("編輯"));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "新內容{Enter}");
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d5")!.title).toBe("新內容");
  });

  it("is read-only when interactive is false", () => {
    const task = useTasksStore.getState().tasks.find((t) => t.id === "d5")!;
    render(<TaskRow task={task} kind="primary" interactive={false} />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.queryByLabelText("刪除")).toBeNull();
  });

  it("renders priority ring when showRing is true and cycles priority on click", async () => {
    const user = userEvent.setup();
    const TestComponent = () => {
      const task = useTasksStore((s) => s.tasks.find((t) => t.id === "d5"))!;
      return <TaskRow task={task} kind="primary" interactive showRing />;
    };
    // seed fills all three slots (d1/d2/d3); free them so promoting d5 lands on slot 1
    useTasksStore.getState().setDailyPriority("d1", null);
    useTasksStore.getState().setDailyPriority("d2", null);
    useTasksStore.getState().setDailyPriority("d3", null);
    render(<TestComponent />);
    const ring = screen.getByRole("button", { name: "設為今日重點" });
    expect(ring).toBeDefined();
    await user.click(ring);
    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d5")!.custom_fields.daily_priority,
    ).toBe("1");
    expect(screen.getByRole("button", { name: "今日重點第 1" })).toBeDefined();
  });
});
