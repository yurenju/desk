import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DayColumn } from "./DayColumn";
import { useTasksStore } from "@/store/tasks";
import { MOCK_TODAY } from "@/mock/data";

beforeEach(() => {
  localStorage.clear();
  useTasksStore.setState({ tasks: [], today: MOCK_TODAY, recentlyDeleted: null });
});

describe("DayColumn empty state", () => {
  it("shows an encouragement message when there is nothing today", () => {
    const tasks = useTasksStore.getState().tasks;
    render(<DayColumn allTasks={tasks} selectedDate={MOCK_TODAY} variant="today-hero" />);
    expect(screen.getByText("今天還很空白")).toBeInTheDocument();
  });
});
