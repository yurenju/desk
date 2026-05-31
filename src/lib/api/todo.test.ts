import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchTodos, patchTodoApi } from "./todo";

beforeEach(() => vi.restoreAllMocks());

describe("todo api client", () => {
  it("fetchTodos hits /api/todo?date= and returns tasks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tasks: [{ id: "tod_1" }] }), { status: 200 }),
    );
    const tasks = await fetchTodos("2026-05-31");
    expect(tasks).toEqual([{ id: "tod_1" }]);
  });

  it("patchTodoApi sends semantic body", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ task: { id: "tod_1" } }), { status: 200 }),
    );
    await patchTodoApi("tod_1", { daily_priority: null });
    const init = spy.mock.calls[0][1]!;
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ daily_priority: null });
  });
});
