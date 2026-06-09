import { handleLogin, handleStatus, handleLogout } from "./routes/auth";
import { handleMe } from "./routes/me";
import { handleListTodo, handleCreateTodo, handlePatchTodo, handleListSubtasks, handleCreateSubtask } from "./routes/todo";
import { handleTestLogin } from "./routes/test-login";
import { handleDevLogin } from "./routes/dev-login";
import { setWspcBase } from "./wspc";

interface Env {
  DESK_KV: KVNamespace;
  WSPC_BASE?: string;
  E2E?: string;
  DEV_LOGIN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    setWspcBase(env.WSPC_BASE);

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (!path.startsWith("/api/")) {
      return new Response(null, { status: 404 });
    }

    // Test-only: seed an authenticated session straight into KV so e2e can skip
    // the real device-code flow. Only mounted when E2E mode is explicitly on.
    if (env.E2E === "true" && path === "/api/test-login" && method === "POST") {
      return handleTestLogin(env);
    }

    // Dev-only: re-attach a cookie to a persisted real-WSPC session so local
    // manual testing skips the device flow on every restart. Mounted only when
    // DEV_LOGIN=true (gitignored .dev.vars), never in production.
    if (env.DEV_LOGIN === "true" && path === "/api/dev-login" && method === "POST") {
      return handleDevLogin(request, env);
    }

    if (path === "/api/auth/login" && method === "POST") {
      return handleLogin(env);
    }

    if (path === "/api/auth/status" && method === "GET") {
      const pollingId = url.searchParams.get("polling_id");
      if (!pollingId) {
        return new Response(
          JSON.stringify({ error: "polling_id required" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      return handleStatus(env, pollingId);
    }

    if (path === "/api/auth/logout" && method === "POST") {
      return handleLogout(request, env);
    }

    if (path === "/api/me" && method === "GET") {
      return handleMe(request, env);
    }

    if (path === "/api/todo" && method === "GET") {
      return handleListTodo(request, env);
    }
    if (path === "/api/todo" && method === "POST") {
      return handleCreateTodo(request, env);
    }
    const subtaskMatch = path.match(/^\/api\/todo\/([^/]+)\/subtasks$/);
    if (subtaskMatch) {
      let parentId: string;
      try {
        parentId = decodeURIComponent(subtaskMatch[1]);
      } catch {
        return new Response(JSON.stringify({ error: "bad_todo_id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (method === "GET") return handleListSubtasks(request, env, parentId);
      if (method === "POST") return handleCreateSubtask(request, env, parentId);
    }

    const todoIdMatch = path.match(/^\/api\/todo\/([^/]+)$/);
    if (todoIdMatch && method === "PATCH") {
      let todoId: string;
      try {
        todoId = decodeURIComponent(todoIdMatch[1]);
      } catch {
        return new Response(JSON.stringify({ error: "bad_todo_id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      return handlePatchTodo(request, env, todoId);
    }

    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
} satisfies ExportedHandler<Env>;
