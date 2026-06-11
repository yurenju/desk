import { it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import * as api from "@/lib/api/todo";
import { useTasksStore } from "@/store/tasks";
import { TodayView } from "./focus";

beforeEach(() => {
  vi.restoreAllMocks();
  useTasksStore.setState({ tasks: [], today: "2026-05-31", status: "idle", error: null });
});

it("triggers a load on mount when status is idle", async () => {
  const spy = vi.spyOn(api, "fetchTodos").mockResolvedValue([]);
  render(<TodayView date="2026-05-31" />);
  await waitFor(() => expect(spy).toHaveBeenCalled());
});
