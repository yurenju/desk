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
});
