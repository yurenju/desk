import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddTaskBar } from "./AddTaskBar";
import { setEntryMode } from "@/lib/entryMode";

beforeEach(() => {
  localStorage.clear();
  setEntryMode("planned");
});

describe("AddTaskBar", () => {
  it("submits the title with the current mode and clears the field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddTaskBar placeholder="加事…" ariaLabel="新增" withMode onSubmit={onSubmit} />);
    const input = screen.getByLabelText("新增");
    await user.type(input, "買菜{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("買菜", "planned");
    expect(input).toHaveValue("");
  });

  it("passes adhoc once the chip is toggled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddTaskBar placeholder="加事…" ariaLabel="新增" withMode onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button")); // toggle chip → adhoc
    await user.type(screen.getByLabelText("新增"), "臨時事{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("臨時事", "adhoc");
  });

  it("does not submit a blank title", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddTaskBar placeholder="加事…" ariaLabel="新增" withMode onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText("新增"), "   {Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("ignores Enter while composing (IME)", () => {
    const onSubmit = vi.fn();
    render(<AddTaskBar placeholder="加事…" ariaLabel="新增" withMode onSubmit={onSubmit} />);
    const input = screen.getByLabelText("新增");
    fireEvent.change(input, { target: { value: "注音" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("hides the chip and omits mode when withMode is false", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddTaskBar placeholder="加事…" ariaLabel="新增" onSubmit={onSubmit} />);
    expect(screen.queryByRole("button")).toBeNull();
    await user.type(screen.getByLabelText("新增"), "backlog 事{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("backlog 事", undefined);
  });
});
