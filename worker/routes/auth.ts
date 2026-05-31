import {
  ensureClientId,
  putDevice,
  getClientId,
  getDevice,
  deleteDevice,
  putSession,
  deleteSession,
} from "../kv";
import { requestDeviceAuthorization, exchangeDeviceCode, getWhoami } from "../wspc";
import { randomBase64UrlId } from "../random";
import {
  serializeSessionCookie,
  parseSessionId,
  clearSessionCookie,
} from "../cookie";

interface Env {
  DESK_KV: KVNamespace;
}

const CLIENT_NAME = "desk.yurenju.me";
const REDIRECT_URIS = ["https://desk.yurenju.me/login"];

export async function handleLogin(env: Env): Promise<Response> {
  const clientId = await ensureClientId(env.DESK_KV, {
    clientName: CLIENT_NAME,
    redirectUris: REDIRECT_URIS,
  });
  const device = await requestDeviceAuthorization(clientId);
  const pollingId = randomBase64UrlId(32);
  await putDevice(
    env.DESK_KV,
    pollingId,
    { deviceCode: device.deviceCode, interval: device.interval },
    device.expiresIn,
  );

  return new Response(
    JSON.stringify({
      verification_uri_complete: device.verificationUriComplete,
      user_code: device.userCode,
      polling_id: pollingId,
      interval: device.interval,
      expires_in: device.expiresIn,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

export async function handleStatus(env: Env, pollingId: string): Promise<Response> {
  const device = await getDevice(env.DESK_KV, pollingId);
  if (!device) {
    return jsonResponse({ state: "expired" });
  }

  const clientId = await getClientId(env.DESK_KV);
  if (!clientId) {
    await deleteDevice(env.DESK_KV, pollingId);
    return jsonResponse({ state: "expired" });
  }

  const result = await exchangeDeviceCode({
    clientId,
    deviceCode: device.deviceCode,
  });

  switch (result.status) {
    case "success": {
      const sessionId = randomBase64UrlId(32);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const me = await getWhoami(result.tokens.accessToken);
      await putSession(env.DESK_KV, sessionId, {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        accessExp: nowSeconds + result.tokens.expiresIn - 5,
        userId: me.userId,
      });
      await deleteDevice(env.DESK_KV, pollingId);
      return jsonResponse(
        { state: "authenticated" },
        { headers: { "Set-Cookie": serializeSessionCookie(sessionId) } },
      );
    }
    case "pending":
      return jsonResponse({ state: "pending" });
    case "slow_down":
      return jsonResponse({ state: "pending", slow_down: true });
    case "denied":
      await deleteDevice(env.DESK_KV, pollingId);
      return jsonResponse({ state: "denied" });
    case "expired":
      await deleteDevice(env.DESK_KV, pollingId);
      return jsonResponse({ state: "expired" });
  }
}

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const sessionId = parseSessionId(request.headers);
  if (sessionId) {
    await deleteSession(env.DESK_KV, sessionId);
  }
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}
