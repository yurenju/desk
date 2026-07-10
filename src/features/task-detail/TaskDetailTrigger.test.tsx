import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Task } from "@/lib/types";
import { useTaskDetailStore } from "./store";
import { TaskDetailTrigger } from "./TaskDetailTrigger";
import { subtaskGlyph } from "./subtaskGlyph";

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

  it("shows done/total when there are subtasks", () => {
    render(<TaskDetailTrigger task={task({ subtask_count: 3, subtask_done: 1 })} />);
    expect(screen.getByText("1/3")).toBeInTheDocument();
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

describe("subtaskGlyph", () => {
  it("is empty at 0 and full at total", () => {
    expect(subtaskGlyph(0, 3)).toBe("○");
    expect(subtaskGlyph(3, 3)).toBe("●");
  });

  it("maps partial progress to quarter pies, never empty or full", () => {
    expect(subtaskGlyph(1, 4)).toBe("◔");
    expect(subtaskGlyph(1, 2)).toBe("◑");
    expect(subtaskGlyph(3, 4)).toBe("◕");
    // a single done out of many still shows some fill, not empty
    expect(subtaskGlyph(1, 8)).toBe("◔");
    // one short of complete still shows a partial pie, not full
    expect(subtaskGlyph(7, 8)).toBe("◕");
  });
});
