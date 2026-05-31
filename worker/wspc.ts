import type { components } from "./wspc-types";

const WSPC_BASE = "https://api.wspc.ai";

type OAuthRegisterBody = components["schemas"]["OAuthRegisterBody"];
type OAuthRegisterResponse = components["schemas"]["OAuthRegisterResponse"];
type DeviceResponse = components["schemas"]["OAuthDeviceResponse"];

export interface RegisterClientInput {
  clientName: string;
  redirectUris: string[];
}

export async function registerClient(input: RegisterClientInput): Promise<string> {
  const body: OAuthRegisterBody = {
    client_name: input.clientName,
    redirect_uris: input.redirectUris,
    token_endpoint_auth_method: "none",
    grant_types: [
      "refresh_token",
      "urn:ietf:params:oauth:grant-type:device_code",
    ],
  };

  const res = await fetch(`${WSPC_BASE}/auth/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`WSPC register failed: ${res.status} ${await res.text()}`);
  }
  let data: OAuthRegisterResponse;
  try {
    data = (await res.json()) as OAuthRegisterResponse;
  } catch (err) {
    throw new Error(
      `WSPC register failed to parse JSON response: ${
        err instanceof Error ? err.message : String(err)
      }`,
      { cause: err }
    );
  }
  // Ensure that client_id exists on the returned object.
  if (!data || typeof data !== "object" || !data.client_id) {
    throw new Error("WSPC register response missing client_id");
  }
  return data.client_id;
}

export interface DeviceAuthorization {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
}

export async function requestDeviceAuthorization(clientId: string): Promise<DeviceAuthorization> {
  const res = await fetch(`${WSPC_BASE}/auth/oauth/device`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId }),
  });
  if (!res.ok) {
    throw new Error(`WSPC device authorization failed: ${res.status} ${await res.text()}`);
  }
  let data: DeviceResponse;
  try {
    data = (await res.json()) as DeviceResponse;
  } catch (err) {
    throw new Error(
      `WSPC device authorization failed to parse JSON response: ${
        err instanceof Error ? err.message : String(err)
      }`,
      { cause: err }
    );
  }
  // Let's perform a runtime sanity check on critical response fields
  if (
    !data ||
    typeof data !== "object" ||
    !data.device_code ||
    !data.user_code ||
    !data.verification_uri ||
    !data.verification_uri_complete ||
    typeof data.expires_in !== "number" ||
    typeof data.interval !== "number"
  ) {
    throw new Error("WSPC device authorization response missing critical fields");
  }
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    verificationUriComplete: data.verification_uri_complete,
    expiresIn: data.expires_in,
    interval: data.interval,
  };
}
