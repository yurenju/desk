import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntryModeChip } from "./EntryModeChip";
import { setEntryMode } from "@/lib/entryMode";

beforeEach(() => {
  localStorage.clear();
  setEntryMode("planned");
});

describe("EntryModeChip", () => {
  it("shows planned label by default", () => {
    render(<EntryModeChip />);
    expect(screen.getByRole("button")).toHaveTextContent("計畫中");
  });

  it("toggles to adhoc on click", async () => {
    const user = userEvent.setup();
    render(<EntryModeChip />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "false");
    await user.click(button);
    expect(button).toHaveTextContent("臨時");
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps sibling chips in sync via shared state", async () => {
    const user = userEvent.setup();
    render(
      <>
        <EntryModeChip />
        <EntryModeChip />
      </>,
    );
    const chips = screen.getAllByRole("button");
    await user.click(chips[0]);
    expect(chips[0]).toHaveTextContent("臨時");
    expect(chips[1]).toHaveTextContent("臨時");
  });
});
