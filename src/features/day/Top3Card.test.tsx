import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Top3Card } from "./Top3Card";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";

beforeEach(() => {
  localStorage.clear();
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, recentlyDeleted: null });
});

describe("Top3Card (interactive)", () => {
  it("toggles done for a top-3 task", async () => {
    const user = userEvent.setup();
    const tasks = useTasksStore.getState().tasks.filter((t) => t.id === "d1");
    render(<Top3Card tasks={tasks} title="今天最重要的三件事" interactive />);
    await user.click(screen.getByRole("checkbox"));
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d1")!.status).toBe("done");
  });

  it("stays read-only when interactive is false", () => {
    const tasks = useTasksStore.getState().tasks.filter((t) => t.id === "d1");
    render(<Top3Card tasks={tasks} title="x" interactive={false} />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});
