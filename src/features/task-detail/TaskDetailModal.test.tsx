import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import * as api from "@/lib/api/todo";
import { useTasksStore } from "@/store/tasks";
import { useTaskDetailStore } from "./store";
import { TaskDetailModal } from "./TaskDetailModal";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "fetchSubtasks").mockResolvedValue([]);
  useTasksStore.setState({
    tasks: [{ id: "t1", title: "Ship MVP", description: "**plan**", status: "open",
      created_at: "", updated_at: "", custom_fields: { daily_priority: "1" }, subtask_count: 0 }],
    status: "ready", error: null, recentlyDeleted: null,
  });
  useTaskDetailStore.setState({ openId: null });
});

describe("TaskDetailModal", () => {
  it("renders nothing when closed", () => {
    render(<TaskDetailModal />);
    expect(screen.queryByText("Ship MVP")).toBeNull();
  });

  it("shows the open task's title and rendered description", async () => {
    useTaskDetailStore.setState({ openId: "t1" });
    render(<TaskDetailModal />);
    expect(await screen.findByDisplayValue("Ship MVP")).toBeInTheDocument();
    expect(screen.getByText("plan").tagName).toBe("STRONG");
  });

  it("shows a delay block for a carried-over task", () => {
    useTasksStore.setState({
      tasks: [{ id: "dly", title: "延遲任務", status: "open", created_at: "", updated_at: "",
        custom_fields: { scheduled_months: ["2026-04", "2026-06"] }, subtask_count: 0 }],
      status: "ready", error: null, recentlyDeleted: null,
    });
    useTaskDetailStore.setState({ openId: "dly" });
    render(<TaskDetailModal />);
    expect(screen.getByText(/跨月拖延 2 個月/)).toBeInTheDocument();
  });

  it("shows no delay block for a fresh this-month task", () => {
    useTasksStore.setState({
      tasks: [{ id: "fresh", title: "新任務", status: "open", created_at: "", updated_at: "",
        custom_fields: { scheduled_months: ["2026-06"] }, subtask_count: 0 }],
      status: "ready", error: null, recentlyDeleted: null,
    });
    useTaskDetailStore.setState({ openId: "fresh" });
    render(<TaskDetailModal />);
    expect(screen.queryByText("拖延狀況")).toBeNull();
  });
});
