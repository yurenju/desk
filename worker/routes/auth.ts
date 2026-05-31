import { ensureClientId, putDevice } from "../kv";
import { requestDeviceAuthorization } from "../wspc";
import { randomBase64UrlId } from "../random";

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
