import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { BacklogRow } from "./BacklogRow";
import { useTasksStore } from "@/store/tasks";
import * as api from "@/lib/api/todo";
import type { Task } from "@/lib/types";

function backlogTask(id: string): Task {
  return {
    id, title: `task-${id}`, status: "open", created_at: "x", updated_at: "x",
    custom_fields: { scheduled_months: [], scheduled_dates: [], is_adhoc: "false" },
  };
}

beforeEach(() => {
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  useTasksStore.setState({ tasks: [backlogTask("a")], status: "ready", error: null });
});

describe("BacklogRow", () => {
  it("promotes to the focus day's top-3 via the menu", async () => {
    render(<BacklogRow task={backlogTask("a")} focusDate="2026-06-08" />);
    await userEvent.click(screen.getByRole("button", { name: "更多動作" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /· ① 三件事/ }));
    const t = useTasksStore.getState().tasks.find((x) => x.id === "a")!;
    expect(t.custom_fields.scheduled_dates).toEqual(["2026-06-08"]);
    expect(t.custom_fields.daily_priority).toBe("1");
    expect(t.custom_fields.scheduled_months).toEqual(["2026-06"]);
  });

  it("promotes to the month via the menu", async () => {
    render(<BacklogRow task={backlogTask("a")} focusDate="2026-06-08" />);
    await userEvent.click(screen.getByRole("button", { name: "更多動作" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /→ 本月/ }));
    expect(
      useTasksStore.getState().tasks.find((x) => x.id === "a")!.custom_fields.scheduled_months,
    ).toEqual(["2026-06"]);
  });

  it("completes the task via the checkbox", async () => {
    render(<BacklogRow task={backlogTask("a")} focusDate="2026-06-08" />);
    await userEvent.click(screen.getByRole("checkbox", { name: "task-a" }));
    expect(useTasksStore.getState().tasks.find((x) => x.id === "a")!.status).toBe("done");
  });
});
