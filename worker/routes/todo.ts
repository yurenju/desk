import * as Sentry from "@sentry/cloudflare";
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
  return withSession(request, env, async ({ accessToken, userId, refreshed }) => {
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
    // Measure the create window: this latency is how long the optimistic temp-id
    // is live client-side, during which an action on it PATCHes temp-xxx → 404.
    // Reported to Sentry so we know how slow create is and how often a token
    // refresh piggybacks the critical path. tracesSampleRate is 0, so we send a
    // message with timings in `extra` rather than a perf span.
    const t0 = Date.now();
    const { projectId, typeId } = await ensureBootstrap(env.DESK_KV, accessToken, userId);
    const t1 = Date.now();
    const todo = await createTodo(accessToken, { title, projectId, typeId, customFields });
    const t2 = Date.now();
    Sentry.captureMessage("create_timing", {
      level: "info",
      tags: { refreshed: String(refreshed) },
      extra: {
        bootstrapMs: t1 - t0,
        createMs: t2 - t1,
        totalMs: t2 - t0,
        refreshed,
      },
    });
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
      position?: string | null;
      done_on?: string | null;
      is_adhoc?: "true" | "false";
      title?: string;
      description?: string;
      scheduled_dates?: string[];
      scheduled_months?: string[];
      unscheduled_at?: string;
      unscheduled_month?: string;
      daily_ranks?: string[];
      monthly_ranks?: string[];
    };
    try {
      body = (await request.json()) as {
        status?: "open" | "in_progress" | "done" | "cancelled";
        daily_priority?: string | null;
        monthly_priority?: string | null;
        position?: string | null;
        done_on?: string | null;
        is_adhoc?: "true" | "false";
        title?: string;
        description?: string;
        scheduled_dates?: string[];
        scheduled_months?: string[];
        unscheduled_at?: string;
        unscheduled_month?: string;
        daily_ranks?: string[];
        monthly_ranks?: string[];
      };
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    const customFields: Record<string, string | string[] | null> = {};
    if ("daily_priority" in body) customFields.daily_priority = body.daily_priority ?? null;
    if ("monthly_priority" in body) customFields.monthly_priority = body.monthly_priority ?? null;
    if ("position" in body) customFields.position = body.position ?? null;
    if ("done_on" in body) customFields.done_on = body.done_on ?? null;
    if ("is_adhoc" in body) customFields.is_adhoc = body.is_adhoc ?? null;
    if ("scheduled_dates" in body && body.scheduled_dates) customFields.scheduled_dates = body.scheduled_dates;
    if ("scheduled_months" in body && body.scheduled_months) customFields.scheduled_months = body.scheduled_months;
    if ("unscheduled_at" in body && body.unscheduled_at) customFields.unscheduled_at = body.unscheduled_at;
    if ("unscheduled_month" in body && body.unscheduled_month)
      customFields.unscheduled_month = body.unscheduled_month;
    if ("daily_ranks" in body && body.daily_ranks) customFields.daily_ranks = body.daily_ranks;
    if ("monthly_ranks" in body && body.monthly_ranks) customFields.monthly_ranks = body.monthly_ranks;
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
