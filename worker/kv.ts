import { registerClient } from "./wspc";

const CLIENT_ID_KEY = "wspc:client_id";

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

