import { it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { Task } from "@/lib/types";
import * as api from "@/lib/api/todo";
import { useTasksStore } from "@/store/tasks";
import { TodayView } from "./focus";

beforeEach(() => {
  vi.restoreAllMocks();
  useTasksStore.setState({ tasks: [], today: "2026-05-31", status: "idle", error: null });
});

it("triggers a load on mount when status is idle", async () => {
  // Keep the fetch pending so status never flips to "ready". That keeps the
  // skeleton rendered and avoids mounting WeekRail / DayChip <Link>s, which need
  // a RouterProvider context this standalone <TodayView> render does not provide
  // (a mounted Link without it throws "Cannot read properties of null (reading
  // 'isServer')" from useLinkProps). We only need to prove the load fires.
  const spy = vi.spyOn(api, "fetchTodos").mockReturnValue(new Promise<Task[]>(() => {}));
  render(<TodayView date="2026-05-31" />);
  await waitFor(() => expect(spy).toHaveBeenCalled());
});
