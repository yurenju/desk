import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteUndoToast } from "./DeleteUndoToast";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";

beforeEach(() => {
  localStorage.clear();
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, recentlyDeleted: null });
});

describe("DeleteUndoToast", () => {
  it("shows nothing when there is no recently deleted task", () => {
    render(<DeleteUndoToast />);
    expect(screen.queryByText("復原")).toBeNull();
  });

  it("appears after a delete and restores on click", async () => {
    const user = userEvent.setup();
    useTasksStore.getState().deleteTask("d6");
    render(<DeleteUndoToast />);
    expect(screen.getByText(/已刪除/)).toBeInTheDocument();
    await user.click(screen.getByText("復原"));
    expect(useTasksStore.getState().tasks.some((t) => t.id === "d6")).toBe(true);
  });

  it("dismisses after 5 seconds automatically", () => {
    vi.useFakeTimers();
    useTasksStore.getState().deleteTask("d6");
    render(<DeleteUndoToast />);
    expect(screen.getByText(/已刪除/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText(/已刪除/)).toBeNull();
    vi.useRealTimers();
  });
});
