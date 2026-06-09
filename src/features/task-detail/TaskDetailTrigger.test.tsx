import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Task } from "@/lib/types";
import { useTaskDetailStore } from "./store";
import { TaskDetailTrigger } from "./TaskDetailTrigger";

function task(over: Partial<Task> = {}): Task {
  return { id: "t1", title: "T", status: "open", created_at: "", updated_at: "", custom_fields: {}, ...over };
}

beforeEach(() => useTaskDetailStore.setState({ openId: null }));

describe("TaskDetailTrigger", () => {
  it("opens the detail store on click", async () => {
    render(<TaskDetailTrigger task={task()} />);
    await userEvent.click(screen.getByLabelText("開啟詳情"));
    expect(useTaskDetailStore.getState().openId).toBe("t1");
  });

  it("shows a subtask-count badge when there are subtasks", () => {
    render(<TaskDetailTrigger task={task({ subtask_count: 3 })} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows a description marker when description is present", () => {
    render(<TaskDetailTrigger task={task({ description: "x" })} />);
    expect(screen.getByLabelText("有描述")).toBeInTheDocument();
  });

  it("renders no badge when neither subtasks nor description", () => {
    render(<TaskDetailTrigger task={task()} />);
    expect(screen.queryByLabelText("有描述")).toBeNull();
    expect(screen.queryByTestId("subtask-badge")).toBeNull();
  });
});
