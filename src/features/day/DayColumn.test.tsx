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

describe("DayColumn copy adapts to the focus date", () => {
  const OTHER = "2099-01-15"; // not today

  it("uses neutral empty-state copy when the focus date is not today", () => {
    render(<DayColumn allTasks={[]} selectedDate={OTHER} variant="plan-narrow" interactive />);
    expect(screen.getByText("這天還很空白")).toBeInTheDocument();
    expect(screen.queryByText("今天還很空白")).not.toBeInTheDocument();
  });

  it("uses neutral section headers when the focus date is not today", () => {
    const mockTasks = [
      { id: "p", title: "重點", status: "open" as const, created_at: "x", updated_at: "x",
        custom_fields: { scheduled_dates: [OTHER], daily_priority: "1" as const } },
      { id: "a", title: "臨時", status: "open" as const, created_at: "x", updated_at: "x",
        custom_fields: { scheduled_dates: [OTHER], is_adhoc: "true" as const } },
    ];
    useTasksStore.setState({ tasks: mockTasks, today: MOCK_TODAY, status: "ready", error: null });
    render(<DayColumn allTasks={mockTasks} selectedDate={OTHER} variant="plan-narrow" interactive />);
    expect(screen.getByText("最重要的三件事")).toBeInTheDocument();
    expect(screen.getByText("臨時加的")).toBeInTheDocument();
    expect(screen.queryByText("今天最重要的三件事")).not.toBeInTheDocument();
    expect(screen.queryByText("今天臨時加的")).not.toBeInTheDocument();
  });
});

describe("DayColumn section assignment", () => {
  it("shows a promoted adhoc task only in Top3, not also in the adhoc section", () => {
    const mockTasks = [
      {
        id: "adhoc-promoted",
        title: "升上重點的臨時任務",
        status: "open" as const,
        created_at: "2026-05-22T00:00:00Z",
        updated_at: "2026-05-22T00:00:00Z",
        custom_fields: {
          scheduled_dates: [MOCK_TODAY],
          is_adhoc: "true" as const,
          daily_priority: "1" as const,
        },
      },
    ];
    useTasksStore.setState({ tasks: mockTasks, today: MOCK_TODAY, status: "ready", error: null });
    render(<DayColumn allTasks={mockTasks} selectedDate={MOCK_TODAY} variant="today-hero" />);

    // Top3 renders it once; the adhoc section must not duplicate it.
    expect(screen.getByText("今天最重要的三件事")).toBeInTheDocument();
    expect(screen.queryByText("今天臨時加的")).not.toBeInTheDocument();
    expect(screen.getAllByText("升上重點的臨時任務")).toHaveLength(1);
  });
});
