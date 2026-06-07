import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteUndoToast } from "./DeleteUndoToast";
import { useTasksStore } from "@/store/tasks";
import * as api from "@/lib/api/todo";

const baseTask = {
  id: "del-1",
  title: "測試任務",
  status: "open" as const,
  created_at: "x",
  updated_at: "x",
  custom_fields: {},
};

beforeEach(() => {
  vi.restoreAllMocks();
  useTasksStore.setState({ tasks: [], error: null, recentlyDeleted: null });
});

describe("DeleteUndoToast", () => {
  it("renders nothing when both recentlyDeleted and error are null", () => {
    const { container } = render(<DeleteUndoToast />);
    expect(container.firstChild).toBeNull();
  });

  it("renders undo toast with task title when recentlyDeleted is set", () => {
    useTasksStore.setState({ recentlyDeleted: { task: baseTask, index: 0 } });
    render(<DeleteUndoToast />);
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText(/測試任務/)).toBeDefined();
    expect(screen.getByRole("button", { name: "復原" })).toBeDefined();
  });

  it("clicking 復原 calls restoreTask", async () => {
    const user = userEvent.setup();
    useTasksStore.setState({
      tasks: [],
      recentlyDeleted: { task: baseTask, index: 0 },
    });
    vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
    render(<DeleteUndoToast />);
    await user.click(screen.getByRole("button", { name: "復原" }));
    expect(useTasksStore.getState().recentlyDeleted).toBeNull();
  });

  it("renders save-failed toast when error is set (and recentlyDeleted is null)", () => {
    useTasksStore.setState({ error: "save_failed" });
    render(<DeleteUndoToast />);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("儲存失敗，請再試一次")).toBeDefined();
  });

  it("undo toast takes priority over error toast when both are set", () => {
    useTasksStore.setState({
      recentlyDeleted: { task: baseTask, index: 0 },
      error: "save_failed",
    });
    render(<DeleteUndoToast />);
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
