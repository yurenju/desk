import { withSession } from "../middleware/session";
import { ensureBootstrap } from "../bootstrap";
import { listTodos, createTodo, patchTodo } from "../wspc";
import { mapTodoToTask } from "../todo-mapper";

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
    const date = new URL(request.url).searchParams.get("date");
    if (!date) return json({ error: "date_required" }, 400);
    const { projectId } = await ensureBootstrap(env.DESK_KV, accessToken, userId);
    const todos = await listTodos(accessToken, { projectId, date });
    return json({ tasks: todos.map(mapTodoToTask) });
  });
}

export async function handleCreateTodo(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async ({ accessToken, userId }) => {
    let body: { title?: string; date?: string };
    try {
      body = (await request.json()) as { title?: string; date?: string };
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    const title = body.title?.trim();
    if (!title || !body.date) return json({ error: "title_and_date_required" }, 400);
    const { projectId, typeId } = await ensureBootstrap(env.DESK_KV, accessToken, userId);
    const todo = await createTodo(accessToken, {
      title,
      projectId,
      typeId,
      customFields: { scheduled_dates: [body.date], is_adhoc: "true" },
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
      done_on?: string | null;
    };
    try {
      body = (await request.json()) as {
        status?: "open" | "in_progress" | "done" | "cancelled";
        daily_priority?: string | null;
        done_on?: string | null;
      };
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    const customFields: Record<string, string | null> = {};
    if ("daily_priority" in body) customFields.daily_priority = body.daily_priority ?? null;
    if ("done_on" in body) customFields.done_on = body.done_on ?? null;
    const todo = await patchTodo(accessToken, id, {
      status: body.status,
      customFields: Object.keys(customFields).length ? customFields : undefined,
    });
    return json({ task: mapTodoToTask(todo) });
  });
}
