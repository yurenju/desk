import { putSession, putBootstrap } from "../kv";
import { serializeSessionCookie } from "../cookie";
import { randomBase64UrlId } from "../random";

interface Env {
  DESK_KV: KVNamespace;
  E2E?: string;
}

// Fixed identity used by e2e. The fake WSPC server seeds its demo todos under
// the same project/type ids so `listTodos` filtering lines up.
const E2E_USER_ID = "e2e-user";
const E2E_PROJECT_ID = "e2e-project";
const E2E_TYPE_ID = "e2e-type";

/**
 * Seed an authenticated session + bootstrap into KV and hand back the session
 * cookie. Guarded by `env.E2E === "true"` at the router, so it is never mounted
 * in production. The access token never expires within a test run, so the
 * session middleware never attempts a refresh against the fake WSPC.
 */
export async function handleTestLogin(env: Env): Promise<Response> {
  const sessionId = randomBase64UrlId(32);
  const farFuture = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

  await putSession(env.DESK_KV, sessionId, {
    accessToken: "e2e-access-token",
    refreshToken: "e2e-refresh-token",
    accessExp: farFuture,
    userId: E2E_USER_ID,
  });
  await putBootstrap(env.DESK_KV, E2E_USER_ID, {
    projectId: E2E_PROJECT_ID,
    typeId: E2E_TYPE_ID,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": serializeSessionCookie(sessionId),
    },
  });
}
