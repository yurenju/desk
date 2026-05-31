import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeKvStub } from "../test-helpers/kv-stub";
import { putSession } from "../kv";
import { handleMe } from "./me";
import * as wspc from "../wspc";

function makeEnv(kv = makeKvStub()) {
  return { DESK_KV: kv } as unknown as { DESK_KV: KVNamespace };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/me", () => {
  it("returns 401 when no session cookie", async () => {
    const env = makeEnv();
    const req = new Request("https://desk.yurenju.me/api/me");
    const res = await handleMe(req, env);
    expect(res.status).toBe(401);
  });

  it("returns whoami passthrough when session is valid", async () => {
    const env = makeEnv();
    await putSession(env.DESK_KV, "sid-1", {
      accessToken: "at-1",
      refreshToken: "rt-1",
      accessExp: Math.floor(Date.now() / 1000) + 600,
    });
    vi.spyOn(wspc, "getWhoami").mockResolvedValue({
      userId: "u-1",
      email: "test@example.com",
      displayName: "Test User",
    });

    const req = new Request("https://desk.yurenju.me/api/me", {
      headers: { Cookie: "__Host-Session=sid-1" },
    });
    const res = await handleMe(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      user_id: "u-1",
      email: "test@example.com",
      display_name: "Test User",
    });
  });
});
