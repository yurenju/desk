import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PriorityRing } from "./PriorityRing";

describe("PriorityRing", () => {
  it("shows the number when a priority is set", () => {
    render(<PriorityRing value="2" onClick={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("2");
  });

  it("renders an empty (add) ring when value is null", () => {
    render(<PriorityRing value={null} onClick={() => {}} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "設為今日重點");
  });

  it("fires onClick", async () => {
    const onClick = vi.fn();
    render(<PriorityRing value="1" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
