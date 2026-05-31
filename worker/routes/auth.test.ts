import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeKvStub } from "../test-helpers/kv-stub";
import { handleLogin } from "./auth";
import { getDevice } from "../kv";
import * as wspc from "../wspc";

function makeEnv(kv = makeKvStub()) {
  return { DESK_KV: kv } as unknown as { DESK_KV: import("@cloudflare/workers-types").KVNamespace };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/auth/login", () => {
  it("ensures client_id, requests device authorization, stores polling state, returns info", async () => {
    const env = makeEnv();
    await env.DESK_KV.put("wspc:client_id", "client-1");
    vi.spyOn(wspc, "requestDeviceAuthorization").mockResolvedValue({
      deviceCode: "dc-1",
      userCode: "ABCD-1234",
      verificationUri: "https://app.wspc.ai/device",
      verificationUriComplete: "https://app.wspc.ai/device?user_code=ABCD-1234",
      expiresIn: 600,
      interval: 5,
    });

    const res = await handleLogin(env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      verification_uri_complete: string;
      user_code: string;
      polling_id: string;
      interval: number;
      expires_in: number;
    };

    expect(body.verification_uri_complete).toBe(
      "https://app.wspc.ai/device?user_code=ABCD-1234",
    );
    expect(body.user_code).toBe("ABCD-1234");
    expect(body.interval).toBe(5);
    expect(body.expires_in).toBe(600);
    expect(body.polling_id).toMatch(/^[A-Za-z0-9_-]+$/);

    const stored = await getDevice(env.DESK_KV, body.polling_id);
    expect(stored).toEqual({ deviceCode: "dc-1", interval: 5 });
  });

  it("registers a client lazily when KV has none", async () => {
    const env = makeEnv();
    vi.spyOn(wspc, "registerClient").mockResolvedValue("fresh-client");
    vi.spyOn(wspc, "requestDeviceAuthorization").mockResolvedValue({
      deviceCode: "dc-1",
      userCode: "ABCD",
      verificationUri: "https://app.wspc.ai/device",
      verificationUriComplete: "https://app.wspc.ai/device?user_code=ABCD",
      expiresIn: 600,
      interval: 5,
    });
    await handleLogin(env);
    expect(await env.DESK_KV.get("wspc:client_id")).toBe("fresh-client");
  });
});
