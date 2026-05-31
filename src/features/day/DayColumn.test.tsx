import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DayColumn } from "./DayColumn";
import { useTasksStore } from "@/store/tasks";
import { MOCK_TODAY } from "@/mock/data";

beforeEach(() => {
  useTasksStore.setState({ tasks: [], today: MOCK_TODAY, status: "ready", error: null });
});

describe("DayColumn empty state", () => {
  it("shows an encouragement message when there is nothing today", () => {
    const tasks = useTasksStore.getState().tasks;
    render(<DayColumn allTasks={tasks} selectedDate={MOCK_TODAY} variant="today-hero" />);
    expect(screen.getByText("今天還很空白")).toBeInTheDocument();
  });

  it("does not show an encouragement message if tasks are present in the column", () => {
    const mockTasks = [
      {
        id: "test-task-1",
        title: "測試任務",
        status: "open" as const,
        parent_id: null,
        created_at: "2026-05-22T00:00:00Z",
        updated_at: "2026-05-22T00:00:00Z",
        custom_fields: {
          scheduled_dates: [MOCK_TODAY],
          is_adhoc: "false" as const,
        },
      },
    ];
    useTasksStore.setState({ tasks: mockTasks, today: MOCK_TODAY, status: "ready", error: null });
    render(<DayColumn allTasks={mockTasks} selectedDate={MOCK_TODAY} variant="today-hero" />);
    expect(screen.queryByText("今天還很空白")).not.toBeInTheDocument();
  });

  it("does not show an encouragement message if variant is plan-narrow, even if the column is empty", () => {
    const tasks = useTasksStore.getState().tasks;
    render(<DayColumn allTasks={tasks} selectedDate={MOCK_TODAY} variant="plan-narrow" />);
    expect(screen.queryByText("今天還很空白")).not.toBeInTheDocument();
  });
});
