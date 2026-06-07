import type { components } from "./wspc-types";

let WSPC_BASE = "https://api.wspc.ai";

// Override the upstream WSPC base URL. Called once per request from the worker
// entrypoint using `env.WSPC_BASE` so e2e runs can point at a local fake while
// production keeps the default. A no-op when `url` is falsy.
export function setWspcBase(url: string | undefined): void {
  if (url) WSPC_BASE = url;
}

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

const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

type TokenResponse = components["schemas"]["OAuthTokenResponse"];

export interface TokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type ExchangeDeviceCodeResult =
  | { status: "success"; tokens: TokenBundle }
  | { status: "pending" }
  | { status: "slow_down" }
  | { status: "denied" }
  | { status: "expired" };

// WSPC may return either RFC 8628 string form { error: "authorization_pending" }
// or wspc envelope form { error: { code: "AUTHORIZATION_PENDING", message } }.
// Normalize both into a lowercase code.
function extractOAuthErrorCode(body: unknown): string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return "";
  const err = (body as { error?: unknown }).error;
  if (typeof err === "string") return err.toLowerCase();
  if (typeof err === "object" && err !== null && !Array.isArray(err)) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string") return code.toLowerCase();
  }
  return "";
}

export async function exchangeDeviceCode(input: {
  clientId: string;
  deviceCode: string;
}): Promise<ExchangeDeviceCodeResult> {
  const res = await fetch(`${WSPC_BASE}/auth/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: DEVICE_CODE_GRANT,
      device_code: input.deviceCode,
      client_id: input.clientId,
    }),
  });

  let body: unknown;
  const clone = res.clone();
  try {
    body = await res.json();
  } catch (err) {
    const text = await clone.text().catch(() => "");
    throw new Error(
      `WSPC token exchange failed (status ${res.status}): ${text || (err instanceof Error ? err.message : String(err))}`,
      { cause: err }
    );
  }

  if (res.ok) {
    const data = body as TokenResponse;
    if (!data || typeof data !== "object" || !data.access_token || !data.refresh_token || typeof data.expires_in !== "number") {
      throw new Error("WSPC token response missing critical fields");
    }
    return {
      status: "success",
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      },
    };
  }

  const code = extractOAuthErrorCode(body);
  switch (code) {
    case "authorization_pending":
      return { status: "pending" };
    case "slow_down":
      return { status: "slow_down" };
    case "access_denied":
      return { status: "denied" };
    // expired_token and invalid_grant are both terminal: a consumed, revoked,
    // or expired device_code. Treat as expiry so the caller restarts the flow
    // instead of bubbling up a 500.
    case "expired_token":
    case "invalid_grant":
      return { status: "expired" };
    default:
      throw new Error(
        `WSPC token exchange failed: ${res.status} ${JSON.stringify(body)}`
      );
  }
}

export async function refreshAccessToken(input: {
  clientId: string;
  refreshToken: string;
}): Promise<TokenBundle> {
  const res = await fetch(`${WSPC_BASE}/auth/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
      client_id: input.clientId,
    }),
  });

  if (!res.ok) {
    const clone = res.clone();
    let errorText: string;
    try {
      const errJson = await res.json();
      errorText = JSON.stringify(errJson);
    } catch {
      errorText = await clone.text().catch(() => "Unknown error");
    }
    throw new Error(`WSPC token refresh failed (status ${res.status}): ${errorText}`);
  }

  let data: TokenResponse;
  try {
    data = (await res.json()) as TokenResponse;
  } catch (err) {
    throw new Error(
      `WSPC token refresh failed to parse JSON response: ${
        err instanceof Error ? err.message : String(err)
      }`,
      { cause: err }
    );
  }

  if (!data || typeof data !== "object" || !data.access_token || !data.refresh_token || typeof data.expires_in !== "number") {
    throw new Error("WSPC token refresh response missing critical fields");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

type WhoamiResponse = components["schemas"]["GetMeResponse"];

export interface Whoami {
  userId: string;
  email: string;
  displayName?: string;
}

export async function getWhoami(accessToken: string): Promise<Whoami> {
  const res = await fetch(`${WSPC_BASE}/auth/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WSPC whoami failed (status ${res.status}): ${text}`);
  }

  let data: WhoamiResponse;
  try {
    data = (await res.json()) as WhoamiResponse;
  } catch (err) {
    throw new Error(
      `WSPC whoami failed to parse JSON response: ${
        err instanceof Error ? err.message : String(err)
      }`,
      { cause: err }
    );
  }

  if (!data || typeof data !== "object" || !data.user_id || !data.email) {
    throw new Error("WSPC whoami response missing critical fields");
  }

  return {
    userId: data.user_id,
    email: data.email,
    displayName: data.display_name,
  };
}

export interface Todo {
  id: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  title: string;
  created_at: number;
  updated_at: number;
  custom_fields?: Record<string, string | string[]>;
}

// Returns all non-cancelled tasks for the given type. Cancelled is excluded by
// omission: we enumerate the three live statuses (open/in_progress/done) rather
// than requesting cancelled. The frontend derives month/week/day/backlog views
// from this full set client-side (no server-side date/cf filter).
export async function listTodos(
  accessToken: string,
  opts: { projectId: string; typeId: string },
): Promise<Todo[]> {
  const params = new URLSearchParams();
  params.set("project_id", opts.projectId);
  params.set("type_id", opts.typeId);
  for (const s of ["open", "in_progress", "done"]) params.append("status", s);
  const res = await fetch(`${WSPC_BASE}/todo/items?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`WSPC listTodos failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { todos?: Todo[] };
  return data.todos ?? [];
}

export async function createTodo(
  accessToken: string,
  body: {
    title: string;
    projectId: string;
    typeId: string;
    customFields: Record<string, string | string[]>;
  },
): Promise<Todo> {
  const res = await fetch(`${WSPC_BASE}/todo/items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: body.title,
      project_id: body.projectId,
      type_id: body.typeId,
      custom_fields: body.customFields,
    }),
  });
  if (!res.ok) {
    throw new Error(`WSPC createTodo failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as Todo;
}

export async function patchTodo(
  accessToken: string,
  id: string,
  body: {
    status?: Todo["status"];
    customFields?: Record<string, string | string[] | null>;
    title?: string;
  },
): Promise<Todo> {
  const payload: Record<string, unknown> = {};
  if (body.title !== undefined) payload.title = body.title;
  if (body.status !== undefined) payload.status = body.status;
  if (body.customFields) payload.custom_fields = body.customFields;
  const res = await fetch(`${WSPC_BASE}/todo/items/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`WSPC patchTodo failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as Todo;
}

export async function createProject(
  accessToken: string,
  name: string,
): Promise<{ id: string }> {
  const res = await fetch(`${WSPC_BASE}/todo/projects`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error(`WSPC createProject failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("WSPC createProject response missing id");
  return { id: data.id };
}

export interface CustomFieldDecl {
  key: string;
  type: "string" | "string_array";
}

export async function createTodoType(
  accessToken: string,
  body: { label: string; projectId: string; customFields: CustomFieldDecl[] },
): Promise<{ id: string }> {
  const res = await fetch(`${WSPC_BASE}/todo/types`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      label: body.label,
      project_id: body.projectId,
      custom_fields: body.customFields,
    }),
  });
  if (!res.ok) {
    throw new Error(`WSPC createTodoType failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("WSPC createTodoType response missing id");
  return { id: data.id };
}
