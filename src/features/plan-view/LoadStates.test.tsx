import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoadSkeleton, LoadError } from "./LoadStates";

it("skeleton renders an aria-busy region with the requested rows", () => {
  const { container } = render(<LoadSkeleton rows={3} />);
  expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  expect(container.querySelectorAll("div")).toHaveLength(3);
});

it("error state shows an alert and fires onRetry", async () => {
  const user = userEvent.setup();
  const onRetry = vi.fn();
  render(<LoadError onRetry={onRetry} />);
  expect(screen.getByRole("alert")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "重試" }));
  expect(onRetry).toHaveBeenCalledOnce();
});
