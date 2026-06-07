import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchTodos, patchTodoApi } from "./todo";

beforeEach(() => vi.restoreAllMocks());

describe("todo api client", () => {
  it("fetchTodos hits /api/todo and returns tasks", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tasks: [{ id: "tod_1" }] }), { status: 200 }),
    );
    const tasks = await fetchTodos();
    expect(tasks).toEqual([{ id: "tod_1" }]);
    expect((spy.mock.calls[0][0] as string)).toBe("/api/todo");
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

  it("patchTodoApi sends title when provided", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ task: { id: "tod_1" } }), { status: 200 }),
    );
    await patchTodoApi("tod_1", { title: "x" });
    const init = spy.mock.calls[0][1]!;
    expect(JSON.parse(init.body as string)).toEqual({ title: "x" });
  });
});
