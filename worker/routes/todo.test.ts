import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeKvStub } from "../test-helpers/kv-stub";
import { putSession, putBootstrap } from "../kv";
import { handleListTodo, handleCreateTodo, handlePatchTodo, handleGetTodo, handleListSubtasks, handleCreateSubtask } from "./todo";
import * as wspc from "../wspc";

function makeEnv(kv = makeKvStub()) {
  return { DESK_KV: kv } as unknown as { DESK_KV: KVNamespace };
}

async function seedSession(env: { DESK_KV: KVNamespace }) {
  await putSession(env.DESK_KV, "sid", {
    accessToken: "at",
    refreshToken: "rt",
    accessExp: Math.floor(Date.now() / 1000) + 600,
    userId: "usr_a",
  });
  // schemaVersion: 2 marks the type as already reconciled, so ensureBootstrap
  // doesn't fire updateTodoType during these route tests.
  await putBootstrap(env.DESK_KV, "usr_a", { projectId: "prj_1", typeId: "typ_1", schemaVersion: 2 });
}

const cookie = { Cookie: "__Host-Session=sid" };

beforeEach(() => vi.restoreAllMocks());

describe("GET /api/todo", () => {
  it("lists all non-cancelled tasks without a date filter", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "listTodos").mockResolvedValue([
      { id: "tod_1", status: "open", title: "A", created_at: 0, updated_at: 0,
        custom_fields: {} },
    ]);
    const req = new Request("https://d/api/todo", { headers: cookie });
    const res = await handleListTodo(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tasks: { id: string }[] };
    expect(body.tasks[0].id).toBe("tod_1");
    // scopes to the bootstrapped project + type, no date/cf filter
    expect(spy.mock.calls[0][1]).toEqual({ projectId: "prj_1", typeId: "typ_1" });
  });

  it("counts done children into subtask_done, skipping childless tasks", async () => {
    const env = makeEnv();
    await seedSession(env);
    vi.spyOn(wspc, "listTodos").mockResolvedValue([
      { id: "p1", status: "open", title: "has kids", created_at: 0, updated_at: 0, custom_fields: {}, child_count: 3 },
      { id: "p2", status: "open", title: "no kids", created_at: 0, updated_at: 0, custom_fields: {}, child_count: 0 },
    ]);
    const children = vi.spyOn(wspc, "listChildren").mockResolvedValue([
      { id: "c1", status: "done", title: "a", created_at: 0, updated_at: 0, custom_fields: {} },
      { id: "c2", status: "done", title: "b", created_at: 0, updated_at: 0, custom_fields: {} },
      { id: "c3", status: "open", title: "c", created_at: 0, updated_at: 0, custom_fields: {} },
    ]);
    const req = new Request("https://d/api/todo", { headers: cookie });
    const res = await handleListTodo(req, env);
    const body = (await res.json()) as { tasks: { id: string; subtask_count?: number; subtask_done?: number }[] };
    const p1 = body.tasks.find((t) => t.id === "p1")!;
    const p2 = body.tasks.find((t) => t.id === "p2")!;
    expect(p1).toMatchObject({ subtask_count: 3, subtask_done: 2 });
    // childless task: done count is unknown/meaningless, field stays absent
    expect(p2.subtask_count).toBe(0);
    expect(p2.subtask_done).toBeUndefined();
    // only the parent with children is fetched
    expect(children).toHaveBeenCalledTimes(1);
    expect(children.mock.calls[0][1]).toMatchObject({ parentId: "p1" });
  });

  it("caps children fetches at the subrequest budget, live parents first", async () => {
    const env = makeEnv();
    await seedSession(env);
    // 50 parents with children: done ones listed FIRST so the test fails if the
    // route fetches in list order instead of prioritizing live parents.
    const doneParents = Array.from({ length: 45 }, (_, i) => ({
      id: `d${i}`, status: "done" as const, title: `done ${i}`,
      created_at: 0, updated_at: 0, custom_fields: {}, child_count: 1,
    }));
    const openParents = Array.from({ length: 5 }, (_, i) => ({
      id: `o${i}`, status: "open" as const, title: `open ${i}`,
      created_at: 0, updated_at: 0, custom_fields: {}, child_count: 1,
    }));
    vi.spyOn(wspc, "listTodos").mockResolvedValue([...doneParents, ...openParents]);
    const children = vi.spyOn(wspc, "listChildren").mockResolvedValue([
      { id: "c", status: "done", title: "c", created_at: 0, updated_at: 0, custom_fields: {} },
    ]);
    const req = new Request("https://d/api/todo", { headers: cookie });
    const res = await handleListTodo(req, env);
    expect(res.status).toBe(200);
    expect(children).toHaveBeenCalledTimes(40);
    const fetched = new Set(children.mock.calls.map((c) => (c[1] as { parentId: string }).parentId));
    // every live parent got its done count; only done parents were skipped
    for (let i = 0; i < 5; i++) expect(fetched.has(`o${i}`)).toBe(true);
    const body = (await res.json()) as { tasks: { id: string; subtask_done?: number }[] };
    const skipped = body.tasks.filter((t) => t.id.startsWith("d") && t.subtask_done === undefined);
    expect(skipped.length).toBe(10); // 45 done - 35 remaining budget
  });

  it("keeps the list alive when one children fetch fails", async () => {
    const env = makeEnv();
    await seedSession(env);
    vi.spyOn(wspc, "listTodos").mockResolvedValue([
      { id: "p1", status: "open", title: "ok", created_at: 0, updated_at: 0, custom_fields: {}, child_count: 1 },
      { id: "p2", status: "open", title: "boom", created_at: 0, updated_at: 0, custom_fields: {}, child_count: 1 },
    ]);
    vi.spyOn(wspc, "listChildren").mockImplementation(async (_at, opts) => {
      if (opts.parentId === "p2") throw new Error("WSPC listChildren failed: 429");
      return [{ id: "c", status: "done", title: "c", created_at: 0, updated_at: 0, custom_fields: {} }];
    });
    const req = new Request("https://d/api/todo", { headers: cookie });
    const res = await handleListTodo(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tasks: { id: string; subtask_done?: number }[] };
    expect(body.tasks.find((t) => t.id === "p1")!.subtask_done).toBe(1);
    expect(body.tasks.find((t) => t.id === "p2")!.subtask_done).toBeUndefined();
  });
});

describe("POST /api/todo", () => {
  it("creates a today adhoc task", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "createTodo").mockResolvedValue({
      id: "tod_new", status: "open", title: "New", created_at: 0, updated_at: 0,
      custom_fields: { scheduled_dates: ["2026-05-31"], is_adhoc: "true" },
    });
    const req = new Request("https://d/api/todo", {
      method: "POST",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New", scheduled_dates: ["2026-05-31"], is_adhoc: "true" }),
    });
    const res = await handleCreateTodo(req, env);
    expect(res.status).toBe(201);
    expect(spy.mock.calls[0][1].customFields).toEqual({
      scheduled_dates: ["2026-05-31"], is_adhoc: "true",
    });
  });

  it("creates a month-scoped task", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "createTodo").mockResolvedValue({
      id: "tod_m", status: "open", title: "Plan", created_at: 0, updated_at: 0,
      custom_fields: { scheduled_months: ["2026-05"], is_adhoc: "false" },
    });
    const req = new Request("https://d/api/todo", {
      method: "POST",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Plan", scheduled_months: ["2026-05"], is_adhoc: "false" }),
    });
    const res = await handleCreateTodo(req, env);
    expect(res.status).toBe(201);
    expect(spy.mock.calls[0][1].customFields).toEqual({
      scheduled_months: ["2026-05"], is_adhoc: "false",
    });
  });
});

describe("PATCH /api/todo/:id", () => {
  it("translates semantic body to WSPC patch", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "patchTodo").mockResolvedValue({
      id: "tod_1", status: "done", title: "A", created_at: 0, updated_at: 0, custom_fields: {},
    });
    const req = new Request("https://d/api/todo/tod_1", {
      method: "PATCH",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", done_on: "2026-05-31T00:00:00Z" }),
    });
    const res = await handlePatchTodo(req, env, "tod_1");
    expect(res.status).toBe(200);
    expect(spy.mock.calls[0][2]).toEqual({
      status: "done", customFields: { done_on: "2026-05-31T00:00:00Z" },
    });
  });

  it("sends daily_priority null clear with no status key", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "patchTodo").mockResolvedValue({
      id: "tod_1", status: "open", title: "A", created_at: 0, updated_at: 0, custom_fields: {},
    });
    const req = new Request("https://d/api/todo/tod_1", {
      method: "PATCH",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ daily_priority: null }),
    });
    await handlePatchTodo(req, env, "tod_1");
    expect(spy.mock.calls[0][2]).toEqual({
      status: undefined,
      customFields: { daily_priority: null },
    });
  });

  it("translates is_adhoc to a custom field", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "patchTodo").mockResolvedValue({
      id: "tod_1", status: "open", title: "A", created_at: 0, updated_at: 0, custom_fields: {},
    });
    const req = new Request("https://d/api/todo/tod_1", {
      method: "PATCH",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ is_adhoc: "false" }),
    });
    await handlePatchTodo(req, env, "tod_1");
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      "tod_1",
      expect.objectContaining({
        customFields: expect.objectContaining({ is_adhoc: "false" }),
      }),
    );
  });

  it("translates monthly_priority and array fields to custom fields", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "patchTodo").mockResolvedValue({
      id: "tod_1", status: "open", title: "A", created_at: 0, updated_at: 0, custom_fields: {},
    });
    const req = new Request("https://d/api/todo/tod_1", {
      method: "PATCH",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        monthly_priority: "1",
        scheduled_dates: ["2026-05-22", "2026-05-23"],
      }),
    });
    await handlePatchTodo(req, env, "tod_1");
    expect(spy.mock.calls[0][2]).toEqual({
      status: undefined,
      customFields: {
        monthly_priority: "1",
        scheduled_dates: ["2026-05-22", "2026-05-23"],
      },
    });
  });

  it("sends monthly_priority null to clear", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "patchTodo").mockResolvedValue({
      id: "tod_1", status: "open", title: "A", created_at: 0, updated_at: 0, custom_fields: {},
    });
    const req = new Request("https://d/api/todo/tod_1", {
      method: "PATCH",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ monthly_priority: null }),
    });
    await handlePatchTodo(req, env, "tod_1");
    expect(spy.mock.calls[0][2].customFields).toEqual({ monthly_priority: null });
  });

  it("forwards unscheduled_month as a custom field", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "patchTodo").mockResolvedValue({
      id: "tod_1", status: "open", title: "A", created_at: 0, updated_at: 0, custom_fields: {},
    });
    const req = new Request("https://d/api/todo/tod_1", {
      method: "PATCH",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ unscheduled_month: "2026-06" }),
    });
    await handlePatchTodo(req, env, "tod_1");
    expect(spy.mock.calls[0][2]).toEqual({
      status: undefined,
      customFields: { unscheduled_month: "2026-06" },
    });
  });

  it("forwards unscheduled_at as a custom field", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "patchTodo").mockResolvedValue({
      id: "tod_1", status: "open", title: "A", created_at: 0, updated_at: 0, custom_fields: {},
    });
    const req = new Request("https://d/api/todo/tod_1", {
      method: "PATCH",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        unscheduled_at: "2026-05-21",
        scheduled_months: ["2026-05"],
        daily_priority: null,
      }),
    });
    await handlePatchTodo(req, env, "tod_1");
    expect(spy.mock.calls[0][2]).toEqual({
      status: undefined,
      customFields: {
        unscheduled_at: "2026-05-21",
        scheduled_months: ["2026-05"],
        daily_priority: null,
      },
    });
  });

  it("passes title through to patchTodo as a top-level field", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "patchTodo").mockResolvedValue({
      id: "tod_1", status: "open", title: "Renamed", created_at: 0, updated_at: 0, custom_fields: {},
    });
    const req = new Request("https://d/api/todo/tod_1", {
      method: "PATCH",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Renamed" }),
    });
    const res = await handlePatchTodo(req, env, "tod_1");
    expect(res.status).toBe(200);
    expect(spy.mock.calls[0][2]).toMatchObject({ title: "Renamed" });
  });
});

describe("GET /api/todo/:id", () => {
  it("returns the single mapped task", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "getTodo").mockResolvedValue({
      id: "sub_1", status: "open", title: "child", description: "body",
      created_at: 0, updated_at: 0, custom_fields: {}, child_count: 2,
    });
    const req = new Request("https://d/api/todo/sub_1", { headers: cookie });
    const res = await handleGetTodo(req, env, "sub_1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { task: { id: string; description?: string; subtask_count?: number } };
    expect(body.task).toMatchObject({ id: "sub_1", description: "body", subtask_count: 2 });
    expect(spy).toHaveBeenCalledWith("at", "sub_1");
  });
});

describe("GET /api/todo/:id/subtasks", () => {
  it("includes each subtask's position so the client can reorder", async () => {
    const env = makeEnv();
    await seedSession(env);
    vi.spyOn(wspc, "listChildren").mockResolvedValue([
      { id: "c1", status: "open", title: "a", created_at: 0, updated_at: 0, custom_fields: { position: "b" } },
    ]);
    const req = new Request("https://d/api/todo/tod_1/subtasks", { headers: cookie });
    const res = await handleListSubtasks(req, env, "tod_1");
    const body = (await res.json()) as { subtasks: { position?: string }[] };
    expect(body.subtasks[0].position).toBe("b");
  });

  it("lists children of a parent", async () => {
    const env = makeEnv();
    await seedSession(env);
    vi.spyOn(wspc, "listChildren").mockResolvedValue([
      { id: "c1", status: "open", title: "step", created_at: 0, updated_at: 0, custom_fields: {} },
    ]);
    const req = new Request("https://d/api/todo/tod_1/subtasks", { headers: cookie });
    const res = await handleListSubtasks(req, env, "tod_1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { subtasks: { id: string }[] };
    expect(body.subtasks[0]).toEqual({ id: "c1", title: "step", status: "open" });
  });

  it("sorts by position, with unset positions kept after set ones in server order", async () => {
    const env = makeEnv();
    await seedSession(env);
    vi.spyOn(wspc, "listChildren").mockResolvedValue([
      { id: "u1", status: "open", title: "unset", created_at: 0, updated_at: 0, custom_fields: {} },
      { id: "c2", status: "open", title: "b", created_at: 0, updated_at: 0, custom_fields: { position: "n" } },
      { id: "c1", status: "open", title: "a", created_at: 0, updated_at: 0, custom_fields: { position: "b" } },
    ]);
    const req = new Request("https://d/api/todo/tod_1/subtasks", { headers: cookie });
    const res = await handleListSubtasks(req, env, "tod_1");
    const body = (await res.json()) as { subtasks: { id: string }[] };
    expect(body.subtasks.map((s) => s.id)).toEqual(["c1", "c2", "u1"]);
  });
});

describe("POST /api/todo/:id/subtasks", () => {
  it("creates a child todo under the parent", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "createTodo").mockResolvedValue({
      id: "c_new", status: "open", title: "new step", created_at: 0, updated_at: 0, custom_fields: {},
    });
    const req = new Request("https://d/api/todo/tod_1/subtasks", {
      method: "POST",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "new step" }),
    });
    const res = await handleCreateSubtask(req, env, "tod_1");
    expect(res.status).toBe(201);
    expect(spy.mock.calls[0][1]).toMatchObject({ title: "new step", parentId: "tod_1" });
  });

  it("rejects an empty title", async () => {
    const env = makeEnv();
    await seedSession(env);
    const req = new Request("https://d/api/todo/tod_1/subtasks", {
      method: "POST",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "  " }),
    });
    const res = await handleCreateSubtask(req, env, "tod_1");
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/todo/:id description", () => {
  it("forwards description to wspc", async () => {
    const env = makeEnv();
    await seedSession(env);
    const spy = vi.spyOn(wspc, "patchTodo").mockResolvedValue({
      id: "tod_1", status: "open", title: "A", created_at: 0, updated_at: 0, custom_fields: {},
    });
    const req = new Request("https://d/api/todo/tod_1", {
      method: "PATCH",
      headers: { ...cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ description: "**hi**" }),
    });
    const res = await handlePatchTodo(req, env, "tod_1");
    expect(res.status).toBe(200);
    expect(spy.mock.calls[0][2]).toMatchObject({ description: "**hi**" });
  });
});
