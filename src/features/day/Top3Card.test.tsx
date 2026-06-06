import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Top3Card } from "./Top3Card";
import { useTasksStore } from "@/store/tasks";
import { allTasks, MOCK_TODAY } from "@/mock/data";
import * as api from "@/lib/api/todo";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "patchTodoApi").mockResolvedValue({} as never);
  useTasksStore.setState({ tasks: allTasks, today: MOCK_TODAY, status: "ready", error: null });
});

const TestComponent = ({ interactive = true }: { interactive?: boolean }) => {
  const tasks = useTasksStore((s) => s.tasks);
  const d1Tasks = tasks.filter((t) => t.id === "d1");
  return <Top3Card tasks={d1Tasks} title="今天最重要的三件事" interactive={interactive} />;
};

describe("Top3Card (interactive)", () => {
  it("toggles done for a top-3 task", async () => {
    const user = userEvent.setup();
    render(<TestComponent />);
    await user.click(screen.getByRole("checkbox"));
    expect(useTasksStore.getState().tasks.find((t) => t.id === "d1")!.status).toBe("done");
  });

  it("stays read-only when interactive is false", () => {
    render(<TestComponent interactive={false} />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.queryByLabelText("刪除")).toBeNull();
  });

  it("edits the title via the edit button and Enter key", async () => {
    const user = userEvent.setup();
    render(<TestComponent />);

    await user.click(screen.getByRole("button", { name: "編輯" }));

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "自定義重點{Enter}");

    expect(useTasksStore.getState().tasks.find((t) => t.id === "d1")!.title).toBe("自定義重點");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("自定義重點")).toBeDefined();
  });

  it("cancels title edits on Escape key", async () => {
    const user = userEvent.setup();
    render(<TestComponent />);

    await user.click(screen.getByRole("button", { name: "編輯" }));

    const input = screen.getByRole("textbox");
    await user.type(input, "修改中...{Escape}");

    expect(useTasksStore.getState().tasks.find((t) => t.id === "d1")!.title).toBe(
      "完成 desk.yurenju.me todo MVP demo",
    );
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("deletes a task when clicking delete button", async () => {
    const user = userEvent.setup();
    render(<TestComponent />);

    const deleteBtn = screen.getByRole("button", { name: "刪除" });
    await user.click(deleteBtn);

    expect(useTasksStore.getState().tasks.find((t) => t.id === "d1")).toBeUndefined();
  });

  it("opens a priority menu and sets the chosen slot", async () => {
    const user = userEvent.setup();
    render(<TestComponent />);

    await user.click(screen.getByRole("button", { name: "今日重點第 1" }));
    await user.click(await screen.findByRole("menuitemradio", { name: /今日第二/ }));

    expect(
      useTasksStore.getState().tasks.find((t) => t.id === "d1")!.custom_fields.daily_priority,
    ).toBe("2");
  });
});
