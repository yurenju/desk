import { withSession } from "../middleware/session";
import { ensureBootstrap } from "../bootstrap";
import { listTodos, createTodo, patchTodo, listChildren } from "../wspc";
import { mapTodoToTask, mapTodoToSubtask } from "../todo-mapper";

interface Env {
  DESK_KV: KVNamespace;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleListTodo(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async ({ accessToken, userId }) => {
    const { projectId, typeId } = await ensureBootstrap(env.DESK_KV, accessToken, userId);
    const todos = await listTodos(accessToken, { projectId, typeId });
    return json({ tasks: todos.map(mapTodoToTask) });
  });
}

export async function handleCreateTodo(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async ({ accessToken, userId }) => {
    let body: {
      title?: string;
      scheduled_dates?: string[];
      scheduled_months?: string[];
      is_adhoc?: "true" | "false";
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    const title = body.title?.trim();
    if (!title) return json({ error: "title_required" }, 400);
    const customFields: Record<string, string | string[]> = {};
    if (body.scheduled_dates) customFields.scheduled_dates = body.scheduled_dates;
    if (body.scheduled_months) customFields.scheduled_months = body.scheduled_months;
    if ("is_adhoc" in body && body.is_adhoc) customFields.is_adhoc = body.is_adhoc;
    const { projectId, typeId } = await ensureBootstrap(env.DESK_KV, accessToken, userId);
    const todo = await createTodo(accessToken, { title, projectId, typeId, customFields });
    return json({ task: mapTodoToTask(todo) }, 201);
  });
}

export async function handlePatchTodo(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  return withSession(request, env, async ({ accessToken, userId }) => {
    await ensureBootstrap(env.DESK_KV, accessToken, userId);
    let body: {
      status?: "open" | "in_progress" | "done" | "cancelled";
      daily_priority?: string | null;
      monthly_priority?: string | null;
      done_on?: string | null;
      is_adhoc?: "true" | "false";
      title?: string;
      description?: string;
      scheduled_dates?: string[];
      scheduled_months?: string[];
      unscheduled_at?: string;
    };
    try {
      body = (await request.json()) as {
        status?: "open" | "in_progress" | "done" | "cancelled";
        daily_priority?: string | null;
        monthly_priority?: string | null;
        done_on?: string | null;
        is_adhoc?: "true" | "false";
        title?: string;
        description?: string;
        scheduled_dates?: string[];
        scheduled_months?: string[];
        unscheduled_at?: string;
      };
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    const customFields: Record<string, string | string[] | null> = {};
    if ("daily_priority" in body) customFields.daily_priority = body.daily_priority ?? null;
    if ("monthly_priority" in body) customFields.monthly_priority = body.monthly_priority ?? null;
    if ("done_on" in body) customFields.done_on = body.done_on ?? null;
    if ("is_adhoc" in body) customFields.is_adhoc = body.is_adhoc ?? null;
    if ("scheduled_dates" in body && body.scheduled_dates) customFields.scheduled_dates = body.scheduled_dates;
    if ("scheduled_months" in body && body.scheduled_months) customFields.scheduled_months = body.scheduled_months;
    if ("unscheduled_at" in body && body.unscheduled_at) customFields.unscheduled_at = body.unscheduled_at;
    const todo = await patchTodo(accessToken, id, {
      status: body.status,
      customFields: Object.keys(customFields).length ? customFields : undefined,
      title: body.title,
      description: body.description,
    });
    return json({ task: mapTodoToTask(todo) });
  });
}

export async function handleListSubtasks(
  request: Request,
  env: Env,
  parentId: string,
): Promise<Response> {
  return withSession(request, env, async ({ accessToken, userId }) => {
    const { projectId, typeId } = await ensureBootstrap(env.DESK_KV, accessToken, userId);
    const children = await listChildren(accessToken, { projectId, typeId, parentId });
    return json({ subtasks: children.map(mapTodoToSubtask) });
  });
}

export async function handleCreateSubtask(
  request: Request,
  env: Env,
  parentId: string,
): Promise<Response> {
  return withSession(request, env, async ({ accessToken, userId }) => {
    let body: { title?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    const title = body.title?.trim();
    if (!title) return json({ error: "title_required" }, 400);
    const { projectId, typeId } = await ensureBootstrap(env.DESK_KV, accessToken, userId);
    const todo = await createTodo(accessToken, {
      title,
      projectId,
      typeId,
      customFields: {},
      parentId,
    });
    return json({ subtask: mapTodoToSubtask(todo) }, 201);
  });
}
