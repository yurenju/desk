import { parseSessionId, clearSessionCookie } from "../cookie";
import { getSession, putSession, deleteSession, getClientId } from "../kv";
import { refreshAccessToken } from "../wspc";

const REFRESH_THRESHOLD_SECONDS = 30;

interface Env {
  DESK_KV: KVNamespace;
}

export interface SessionContext {
  accessToken: string;
  userId: string;
}

export type SessionHandler = (ctx: SessionContext) => Promise<Response>;

export async function withSession(
  request: Request,
  env: Env,
  handler: SessionHandler,
): Promise<Response> {
  const sessionId = parseSessionId(request.headers);
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = await getSession(env.DESK_KV, sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: "session_invalid" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": clearSessionCookie(),
      },
    });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  let accessToken = session.accessToken;

  if (session.accessExp - nowSeconds < REFRESH_THRESHOLD_SECONDS) {
    const clientId = await getClientId(env.DESK_KV);
    if (!clientId) {
      await deleteSession(env.DESK_KV, sessionId);
      return new Response(JSON.stringify({ error: "client_missing" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": clearSessionCookie(),
        },
      });
    }
    try {
      const tokens = await refreshAccessToken({
        clientId,
        refreshToken: session.refreshToken,
      });
      const newAccessExp = nowSeconds + tokens.expiresIn - 5;
      await putSession(env.DESK_KV, sessionId, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessExp: newAccessExp,
        userId: session.userId,
      });
      accessToken = tokens.accessToken;
    } catch {
      await deleteSession(env.DESK_KV, sessionId);
      return new Response(JSON.stringify({ error: "refresh_failed" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": clearSessionCookie(),
        },
      });
    }
  }

  return handler({ accessToken, userId: session.userId });
}
