import type { components } from "./wspc-types";

const WSPC_BASE = "https://api.wspc.ai";

type OAuthRegisterBody = components["schemas"]["OAuthRegisterBody"];
type OAuthRegisterResponse = components["schemas"]["OAuthRegisterResponse"];

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
  const data = (await res.json()) as OAuthRegisterResponse;
  // Ensure that client_id exists on the returned object.
  if (!data.client_id) {
    throw new Error("WSPC register response missing client_id");
  }
  return data.client_id;
}
