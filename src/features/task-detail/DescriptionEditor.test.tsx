import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DescriptionEditor } from "./DescriptionEditor";

describe("DescriptionEditor", () => {
  it("renders markdown in view mode", () => {
    render(<DescriptionEditor value="**bold**" onSave={() => {}} />);
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("shows a placeholder when empty and enters edit on click", async () => {
    render(<DescriptionEditor value="" onSave={() => {}} />);
    await userEvent.click(screen.getByText("加上描述…"));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("saves on blur with the edited text", async () => {
    const onSave = vi.fn();
    render(<DescriptionEditor value="old" onSave={onSave} />);
    await userEvent.click(screen.getByLabelText("編輯描述"));
    const ta = screen.getByRole("textbox");
    await userEvent.clear(ta);
    await userEvent.type(ta, "new");
    await userEvent.tab();
    expect(onSave).toHaveBeenCalledWith("new");
  });
});
