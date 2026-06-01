/**
 * Stateful in-memory fake of the WSPC API for e2e.
 *
 * The desk worker (BFF) runs for real under `npm run dev`; this stands in for
 * the upstream WSPC service it calls. It implements only the endpoints the
 * worker actually hits, with enough state that mutation flows (add / complete /
 * delete / undo) behave like the real thing within a test run.
 *
 * Demo todos are seeded for *today* (computed at reset time) so they line up
 * with the date `/today` requests. `POST /__reset` reseeds between tests.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const PORT = Number(process.env.WSPC_FAKE_PORT ?? 8788);

const PROJECT_ID = "e2e-project";
const TYPE_ID = "e2e-type";

type Status = "open" | "in_progress" | "done" | "cancelled";

interface Todo {
  id: string;
  project_id: string;
  type_id: string;
  status: Status;
  title: string;
  created_at: number;
  updated_at: number;
  custom_fields: Record<string, string | string[]>;
}

let todos: Todo[] = [];
let idCounter = 0;

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function seed(): void {
  const today = todayISO();
  const base = Date.parse("2026-05-22T00:00:00Z");
  let n = 0;
  const mk = (
    id: string,
    title: string,
    status: Status,
    cf: Record<string, string | string[]>,
  ): Todo => ({
    id,
    project_id: PROJECT_ID,
    type_id: TYPE_ID,
    status,
    title,
    created_at: base + n * 1000,
    updated_at: base + n++ * 1000,
    custom_fields: { scheduled_dates: [today], ...cf },
  });

  todos = [
    // 今天最重要的三件事 (Top3)
    mk("d1", "完成 desk.yurenju.me todo MVP demo", "open", {
      daily_priority: "1",
      is_adhoc: "false",
    }),
    mk("d2", "寫週報 + 5 月中檢視", "open", { daily_priority: "2", is_adhoc: "false" }),
    mk("d3", "retro:整理本週學習+下週主題", "open", {
      daily_priority: "3",
      is_adhoc: "false",
    }),
    // 其他計劃內
    mk("d4", "1hr 健身", "done", {
      is_adhoc: "false",
      done_on: `${today}T07:30:00Z`,
    }),
    mk("d5", "讀 WSPC custom fields 文件", "open", { is_adhoc: "false" }),
    // 今天臨時加的
    mk("d6", "回覆 Acme 客戶整合詢問", "open", { is_adhoc: "true" }),
  ];
  idCounter = 0;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(json);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method ?? "GET";

  // ── Test harness controls ──────────────────────────────────────────────
  if (path === "/__health") return send(res, 200, { ok: true });
  if (path === "/__reset" && method === "POST") {
    seed();
    return send(res, 200, { ok: true });
  }

  // ── Auth ───────────────────────────────────────────────────────────────
  if (path === "/auth/me" && method === "GET") {
    return send(res, 200, {
      user_id: "e2e-user",
      email: "e2e@example.com",
      display_name: "E2E User",
    });
  }

  // ── Todo items ─────────────────────────────────────────────────────────
  if (path === "/todo/items" && method === "GET") {
    const projectId = url.searchParams.get("project_id");
    const date = url.searchParams.get("cf.scheduled_dates");
    const statuses = url.searchParams.getAll("status");
    const result = todos.filter((t) => {
      if (projectId && t.project_id !== projectId) return false;
      if (statuses.length && !statuses.includes(t.status)) return false;
      if (date) {
        const dates = t.custom_fields.scheduled_dates;
        if (!Array.isArray(dates) || !dates.includes(date)) return false;
      }
      return true;
    });
    return send(res, 200, { todos: result });
  }

  if (path === "/todo/items" && method === "POST") {
    const body = await readJson(req);
    const now = Date.parse("2026-05-22T12:00:00Z") + ++idCounter * 1000;
    const todo: Todo = {
      id: `e2e-new-${idCounter}`,
      project_id: String(body.project_id ?? PROJECT_ID),
      type_id: String(body.type_id ?? TYPE_ID),
      status: "open",
      title: String(body.title ?? ""),
      created_at: now,
      updated_at: now,
      custom_fields: (body.custom_fields as Record<string, string | string[]>) ?? {},
    };
    todos.push(todo);
    return send(res, 201, todo);
  }

  const itemMatch = path.match(/^\/todo\/items\/([^/]+)$/);
  if (itemMatch && method === "PATCH") {
    const id = decodeURIComponent(itemMatch[1]);
    const todo = todos.find((t) => t.id === id);
    if (!todo) return send(res, 404, { error: { code: "NOT_FOUND" } });
    const body = await readJson(req);
    if (typeof body.title === "string") todo.title = body.title;
    if (typeof body.status === "string") todo.status = body.status as Status;
    if (body.custom_fields && typeof body.custom_fields === "object") {
      for (const [k, v] of Object.entries(body.custom_fields as Record<string, unknown>)) {
        if (v === null) delete todo.custom_fields[k];
        else todo.custom_fields[k] = v as string | string[];
      }
    }
    todo.updated_at = Date.parse("2026-05-22T12:00:00Z") + ++idCounter * 1000;
    return send(res, 200, todo);
  }

  // ── Bootstrap fallbacks (normally pre-seeded via test-login) ────────────
  if (path === "/todo/projects" && method === "POST") return send(res, 201, { id: PROJECT_ID });
  if (path === "/todo/types" && method === "POST") return send(res, 201, { id: TYPE_ID });

  send(res, 404, { error: { code: "NOT_FOUND", message: `${method} ${path}` } });
});

seed();
server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[wspc-fake] listening on http://localhost:${PORT}`);
});
