import * as Sentry from "@sentry/cloudflare";
import { withSession } from "../middleware/session";
import { ensureBootstrap } from "../bootstrap";
import {
  listTodos,
  createTodo,
  patchTodo,
  getTodo,
  listChildren,
  listComments,
  createComment,
  updateComment,
  deleteComment,
} from "../wspc";
import { mapTodoToTask, mapTodoToSubtask, mapComment } from "../todo-mapper";

interface Env {
  DESK_KV: KVNamespace;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Each children fetch is a subrequest, and the Workers free plan caps a request
// at 50 total (listTodos pages, KV reads and the Sentry envelope eat a few).
// An unbounded per-parent fan-out took the whole route down with
// "Too many subrequests" (error 1101) once enough done tasks accumulated.
// ponytail: hard budget, live parents first — if >40 live parents ever carry
// subtasks, move done-counting client-side or denormalize onto the parent.
const CHILDREN_FETCH_BUDGET = 40;

export async function handleListTodo(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async ({ accessToken, userId }) => {
    const { projectId, typeId } = await ensureBootstrap(env.DESK_KV, accessToken, userId);
    const todos = await listTodos(accessToken, { projectId, typeId });
    // child_count gives the total, but not how many children are done. Fetch
    // children (in parallel) for tasks that have any, within the budget: live
    // parents first (their badges matter most), done parents with what's left.
    const withChildren = todos.filter((t) => (t.child_count ?? 0) > 0);
    const countable = new Set(
      [
        ...withChildren.filter((t) => t.status !== "done"),
        ...withChildren.filter((t) => t.status === "done"),
      ]
        .slice(0, CHILDREN_FETCH_BUDGET)
        .map((t) => t.id),
    );
    const tasks = await Promise.all(
      todos.map(async (todo) => {
        const task = mapTodoToTask(todo);
        if (countable.has(todo.id)) {
          try {
            const children = await listChildren(accessToken, { projectId, typeId, parentId: todo.id });
            task.subtask_done = children.filter((c) => c.status === "done").length;
          } catch {
            // Done count stays unknown; the badge falls back to total-only.
            // One flaky child fetch must not 500 the whole list.
          }
        }
        return task;
      }),
    );
    return json({ tasks });
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
      unscheduled_at?: string | null;
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
        unscheduled_at?: string | null;
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
    // null clears the field (restore-to-day); absent leaves it untouched.
    if ("unscheduled_at" in body) customFields.unscheduled_at = body.unscheduled_at ?? null;
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

// Single-todo lookup: the detail modal uses this for subtasks, which the
// root todo list (and thus the client tasks store) never contains.
export async function handleGetTodo(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  return withSession(request, env, async ({ accessToken, userId }) => {
    await ensureBootstrap(env.DESK_KV, accessToken, userId);
    const todo = await getTodo(accessToken, id);
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
    // Sort by the `position` custom field, mirroring byPosition() semantics for
    // top-level tasks: set positions first (ascending string), unset keep server
    // order (stable sort). mapTodoToSubtask drops position, so sort before mapping.
    const sorted = [...children].sort((a, b) => {
      const pa = a.custom_fields?.position as string | undefined;
      const pb = b.custom_fields?.position as string | undefined;
      if (pa && pb) return pa < pb ? -1 : pa > pb ? 1 : 0;
      if (pa && !pb) return -1;
      if (!pa && pb) return 1;
      return 0;
    });
    return json({ subtasks: sorted.map(mapTodoToSubtask) });
  });
}

export async function handleListComments(
  request: Request,
  env: Env,
  todoId: string,
): Promise<Response> {
  return withSession(request, env, async ({ accessToken }) => {
    const comments = await listComments(accessToken, todoId);
    return json({ comments: comments.map(mapComment) });
  });
}

export async function handleCreateComment(
  request: Request,
  env: Env,
  todoId: string,
): Promise<Response> {
  return withSession(request, env, async ({ accessToken }) => {
    let body: { content?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    const content = body.content?.trim();
    if (!content) return json({ error: "content_required" }, 400);
    const comment = await createComment(accessToken, todoId, content);
    return json({ comment: mapComment(comment) }, 201);
  });
}

export async function handleUpdateComment(
  request: Request,
  env: Env,
  commentId: string,
): Promise<Response> {
  return withSession(request, env, async ({ accessToken }) => {
    let body: { content?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    const content = body.content?.trim();
    if (!content) return json({ error: "content_required" }, 400);
    const comment = await updateComment(accessToken, commentId, content);
    return json({ comment: mapComment(comment) });
  });
}

export async function handleDeleteComment(
  request: Request,
  env: Env,
  commentId: string,
): Promise<Response> {
  return withSession(request, env, async ({ accessToken }) => {
    await deleteComment(accessToken, commentId);
    return new Response(null, { status: 204 });
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
