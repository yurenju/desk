import * as Sentry from "@sentry/cloudflare";
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
  // True when this request piggybacked a token refresh on the critical path
  // (widens the create window — see temp-id PATCH 404 investigation).
  refreshed: boolean;
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
  let refreshed = false;

  if (session.accessExp - nowSeconds < REFRESH_THRESHOLD_SECONDS) {
    // Tag every event with a stable-but-non-secret session marker so concurrent
    // refresh attempts on the SAME session (the suspected race) group together
    // in Sentry: one success + N invalid_grant failures within ~1s == confirmed.
    const sess = sessionId.slice(-8);
    Sentry.addBreadcrumb({
      category: "auth.refresh",
      message: "refresh_start",
      level: "info",
      data: { sess, remaining: session.accessExp - nowSeconds },
    });
    const clientId = await getClientId(env.DESK_KV);
    if (!clientId) {
      await deleteSession(env.DESK_KV, sessionId);
      Sentry.captureMessage("session_deleted:client_missing", {
        level: "warning",
        tags: { sess, phase: "refresh" },
      });
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
      refreshed = true;
      Sentry.captureMessage("refresh_succeeded", {
        level: "info",
        tags: { sess, phase: "refresh" },
      });
    } catch (e) {
      // The error message carries the WSPC status + body (e.g. invalid_grant),
      // which is the direct evidence for the rotated-refresh-token race.
      Sentry.captureException(e, {
        tags: { sess, phase: "refresh" },
        extra: { remaining: session.accessExp - nowSeconds },
      });
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

  return handler({ accessToken, userId: session.userId, refreshed });
}
