import { registerClient } from "./wspc";

const CLIENT_ID_KEY = "wspc:client_id";

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  accessExp: number; // unix seconds
  userId: string;
}

export async function getSession(
  kv: KVNamespace,
  id: string,
): Promise<SessionData | null> {
  const raw = await kv.get(`session:${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export async function putSession(
  kv: KVNamespace,
  id: string,
  data: SessionData,
): Promise<void> {
  await kv.put(`session:${id}`, JSON.stringify(data), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
}

export async function deleteSession(kv: KVNamespace, id: string): Promise<void> {
  await kv.delete(`session:${id}`);
}

export interface ClientRegistrationConfig {
  clientName: string;
  redirectUris: string[];
}

export async function getClientId(kv: KVNamespace): Promise<string | null> {
  return kv.get(CLIENT_ID_KEY);
}

export async function ensureClientId(
  kv: KVNamespace,
  config: ClientRegistrationConfig,
): Promise<string> {
  const existing = await kv.get(CLIENT_ID_KEY);
  if (existing) return existing;
  const id = await registerClient(config);
  await kv.put(CLIENT_ID_KEY, id);
  return id;
}

export interface DeviceData {
  deviceCode: string;
  interval: number;
}

export async function getDevice(
  kv: KVNamespace,
  pollingId: string,
): Promise<DeviceData | null> {
  const raw = await kv.get(`device:${pollingId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeviceData;
  } catch {
    return null;
  }
}

export async function putDevice(
  kv: KVNamespace,
  pollingId: string,
  data: DeviceData,
  ttlSeconds: number,
): Promise<void> {
  await kv.put(`device:${pollingId}`, JSON.stringify(data), {
    expirationTtl: ttlSeconds,
  });
}

export async function deleteDevice(kv: KVNamespace, pollingId: string): Promise<void> {
  await kv.delete(`device:${pollingId}`);
}

export interface BootstrapData {
  projectId: string;
  typeId: string;
}

export async function getBootstrap(
  kv: KVNamespace,
  userId: string,
): Promise<BootstrapData | null> {
  const raw = await kv.get(`desk:bootstrap:${userId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BootstrapData;
  } catch {
    return null;
  }
}

export async function putBootstrap(
  kv: KVNamespace,
  userId: string,
  data: BootstrapData,
): Promise<void> {
  await kv.put(`desk:bootstrap:${userId}`, JSON.stringify(data));
}

