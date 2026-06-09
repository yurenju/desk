import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubtaskList } from "./SubtaskList";
import type { Subtask } from "@/lib/types";

const subs: Subtask[] = [
  { id: "c1", title: "done one", status: "done" },
  { id: "c2", title: "open one", status: "open" },
];

describe("SubtaskList", () => {
  it("shows done/total progress", () => {
    render(<SubtaskList subtasks={subs} onToggle={() => {}} onRename={() => {}} onRemove={() => {}} onAdd={() => {}} />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("toggles a subtask", async () => {
    const onToggle = vi.fn();
    render(<SubtaskList subtasks={subs} onToggle={onToggle} onRename={() => {}} onRemove={() => {}} onAdd={() => {}} />);
    await userEvent.click(screen.getByLabelText("open one"));
    expect(onToggle).toHaveBeenCalledWith("c2");
  });

  it("adds a subtask on Enter", async () => {
    const onAdd = vi.fn();
    render(<SubtaskList subtasks={[]} onToggle={() => {}} onRename={() => {}} onRemove={() => {}} onAdd={onAdd} />);
    const input = screen.getByPlaceholderText("新增子任務…");
    await userEvent.type(input, "third{Enter}");
    expect(onAdd).toHaveBeenCalledWith("third");
  });

  it("removes a subtask", async () => {
    const onRemove = vi.fn();
    render(<SubtaskList subtasks={subs} onToggle={() => {}} onRename={() => {}} onRemove={onRemove} onAdd={() => {}} />);
    await userEvent.click(screen.getAllByLabelText("刪除子任務")[0]);
    expect(onRemove).toHaveBeenCalledWith("c1");
  });
});
