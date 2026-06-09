import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchTodos, patchTodoApi, fetchSubtasks, createSubtask } from "./todo";

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

describe("fetchSubtasks", () => {
  it("GETs the subtasks endpoint and returns the list", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ subtasks: [{ id: "c1", title: "s", status: "open" }] }), { status: 200 }),
    );
    const out = await fetchSubtasks("tod_1");
    expect(out).toEqual([{ id: "c1", title: "s", status: "open" }]);
    expect(spy.mock.calls[0][0]).toBe("/api/todo/tod_1/subtasks");
  });
});

describe("createSubtask", () => {
  it("POSTs the title and returns the new subtask", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ subtask: { id: "c2", title: "new", status: "open" } }), { status: 201 }),
    );
    const out = await createSubtask("tod_1", "new");
    expect(out.id).toBe("c2");
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ title: "new" });
  });
});
