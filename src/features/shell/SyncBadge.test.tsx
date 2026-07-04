import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SyncBadge } from "./SyncBadge";
import { useTasksStore } from "@/store/tasks";

describe("SyncBadge", () => {
  beforeEach(() => {
    useTasksStore.setState({ synced: true });
  });

  it("renders nothing when synced", () => {
    render(<SyncBadge />);
    expect(screen.queryByText("未同步")).toBeNull();
  });

  it("shows 未同步 when not synced", () => {
    useTasksStore.setState({ synced: false });
    render(<SyncBadge />);
    expect(screen.getByText("未同步")).toBeInTheDocument();
  });
});
