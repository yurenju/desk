import { parseSessionId, serializeSessionCookie } from "../cookie";
import {
  getSession,
  putSession,
  getClientId,
  getDevSessionId,
  putDevSessionId,
  getDevRefreshSeed,
  putDevRefreshSeed,
} from "../kv";
import { refreshAccessToken } from "../wspc";
import { randomBase64UrlId } from "../random";

interface Env {
  DESK_KV: KVNamespace;
  // Cold-start seed (gitignored .dev.vars) used only when local KV has been
  // fully wiped, so even then we can mint a session without a new device flow.
  // Best-effort: subject to WSPC refresh-token rotation, so it may be single-use.
  // DEV_CLIENT_ID is the OAuth client the refresh token was issued under; a
  // refresh only works with that exact client, and a fresh worktree's empty KV
  // has no registered client — so it must travel alongside the seed.
  DEV_REFRESH_SEED?: string;
  DEV_USER_ID?: string;
  DEV_CLIENT_ID?: string;
}

function json(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

/**
 * Local-only convenience to skip the real device flow on every preview restart.
 * Mounted only when `env.DEV_LOGIN === "true"` (set in gitignored `.dev.vars`),
 * so it never exists in production. Unlike `test-login`, this drives the REAL
 * WSPC: it never mints fake tokens, it only re-attaches a cookie to a session
 * that a genuine device-flow login already created.
 *
 * Three modes, chosen by request state:
 *   - capture: caller carries a live session cookie -> remember that session id
 *     as the canonical dev session and back up its refresh token.
 *   - reissue: no cookie but a persisted dev session is still alive in KV
 *     -> Set-Cookie back to it (the common case across preview restarts).
 *   - mint: KV lost the session but a refresh seed survives -> mint a fresh
 *     session from it (subject to WSPC refresh-token rotation).
 */
export async function handleDevLogin(
  request: Request,
  env: Env,
): Promise<Response> {
  // capture: the browser just completed a real device-flow login.
  const existingId = parseSessionId(request.headers);
  if (existingId) {
    const session = await getSession(env.DESK_KV, existingId);
    if (session) {
      await putDevSessionId(env.DESK_KV, existingId);
      await putDevRefreshSeed(env.DESK_KV, {
        refreshToken: session.refreshToken,
        userId: session.userId,
      });
      return json(
        {
          ok: true,
          mode: "capture",
          sessionId: existingId,
          userId: session.userId,
          // Returned so the agent can stash these in .dev.vars as a durable seed
          // that survives even a full local KV wipe. clientId is required because
          // the refresh token only works under the client it was issued for.
          refreshToken: session.refreshToken,
          clientId: await getClientId(env.DESK_KV),
        },
        200,
      );
    }
  }

  // reissue: re-point a fresh browser at the still-living dev session.
  const savedId = await getDevSessionId(env.DESK_KV);
  if (savedId && (await getSession(env.DESK_KV, savedId))) {
    return json({ ok: true, mode: "reissue", sessionId: savedId }, 200, {
      "Set-Cookie": serializeSessionCookie(savedId),
    });
  }

  // mint: recover from a KV wipe using the backed-up refresh token. Prefer the
  // KV seed (kept rotated-current); fall back to the cold-start .dev.vars seed
  // when KV has been fully cleared.
  const seed =
    (await getDevRefreshSeed(env.DESK_KV)) ??
    (env.DEV_REFRESH_SEED && env.DEV_USER_ID
      ? { refreshToken: env.DEV_REFRESH_SEED, userId: env.DEV_USER_ID }
      : null);
  if (seed) {
    // The refresh token is bound to a specific OAuth client. Prefer the client
    // registered in KV; on a fully-wiped worktree KV, fall back to the client id
    // captured alongside the cold-start seed in .dev.vars.
    const clientId = (await getClientId(env.DESK_KV)) ?? env.DEV_CLIENT_ID;
    if (!clientId) {
      return json({ ok: false, error: "client_missing" }, 409);
    }
    try {
      const tokens = await refreshAccessToken({
        clientId,
        refreshToken: seed.refreshToken,
      });
      const sessionId = randomBase64UrlId(32);
      const accessExp = Math.floor(Date.now() / 1000) + tokens.expiresIn - 5;
      await putSession(env.DESK_KV, sessionId, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessExp,
        userId: seed.userId,
      });
      await putDevSessionId(env.DESK_KV, sessionId);
      await putDevRefreshSeed(env.DESK_KV, {
        refreshToken: tokens.refreshToken,
        userId: seed.userId,
      });
      return json({ ok: true, mode: "mint", sessionId }, 200, {
        "Set-Cookie": serializeSessionCookie(sessionId),
      });
    } catch {
      return json(
        {
          ok: false,
          error: "seed_refresh_failed",
          hint: "Re-run the real device flow once, then POST /api/dev-login carrying the session cookie to re-capture.",
        },
        401,
      );
    }
  }

  return json(
    {
      ok: false,
      error: "no_dev_session",
      hint: "Log in once via the real device flow, then POST /api/dev-login carrying the session cookie to capture it.",
    },
    401,
  );
}
