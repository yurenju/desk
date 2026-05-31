import { handleLogin, handleStatus, handleLogout } from "./routes/auth";
import { handleMe } from "./routes/me";

interface Env {
  DESK_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (!path.startsWith("/api/")) {
      return new Response(null, { status: 404 });
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

    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
} satisfies ExportedHandler<Env>;
