import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeKvStub } from "../test-helpers/kv-stub";
import { putSession, getSession } from "../kv";
import { withSession } from "./session";
import * as wspc from "../wspc";

function makeEnv(kv = makeKvStub()) {
  return { DESK_KV: kv } as unknown as { DESK_KV: import("@cloudflare/workers-types").KVNamespace };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("withSession", () => {
  it("returns 401 when cookie is missing", async () => {
    const env = makeEnv();
    const req = new Request("https://desk.yurenju.me/api/me");
    const res = await withSession(req, env, async () => new Response("ok"));
    expect(res.status).toBe(401);
  });

  it("returns 401 and clears cookie when KV has no matching session", async () => {
    const env = makeEnv();
    const req = new Request("https://desk.yurenju.me/api/me", {
      headers: { Cookie: "__Host-Session=ghost" },
    });
    const res = await withSession(req, env, async () => new Response("ok"));
    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("calls handler with access_token when session is valid and not near expiry", async () => {
    const env = makeEnv();
    const futureExp = Math.floor(Date.now() / 1000) + 600;
    await putSession(env.DESK_KV, "sid-1", {
      accessToken: "at-1",
      refreshToken: "rt-1",
      accessExp: futureExp,
    });
    vi.spyOn(env.DESK_KV, "put"); // ensure we don't refresh

    const req = new Request("https://desk.yurenju.me/api/me", {
      headers: { Cookie: "__Host-Session=sid-1" },
    });
    const handler = vi.fn(async (token: string) => new Response(token));
    const res = await withSession(req, env, handler);

    expect(handler).toHaveBeenCalledWith("at-1");
    expect(await res.text()).toBe("at-1");
  });

  it("refreshes when access token is close to expiry, writes back, calls handler", async () => {
    const env = makeEnv();
    const nearExp = Math.floor(Date.now() / 1000) + 10; // 10s left
    await putSession(env.DESK_KV, "sid-1", {
      accessToken: "at-old",
      refreshToken: "rt-old",
      accessExp: nearExp,
    });
    await env.DESK_KV.put("wspc:client_id", "client-1");
    vi.spyOn(wspc, "refreshAccessToken").mockResolvedValue({
      accessToken: "at-new",
      refreshToken: "rt-new",
      expiresIn: 900,
    });

    const req = new Request("https://desk.yurenju.me/api/me", {
      headers: { Cookie: "__Host-Session=sid-1" },
    });
    const handler = vi.fn(async (token: string) => new Response(token));
    const res = await withSession(req, env, handler);

    expect(handler).toHaveBeenCalledWith("at-new");
    expect(await res.text()).toBe("at-new");
    const stored = await getSession(env.DESK_KV, "sid-1");
    expect(stored?.accessToken).toBe("at-new");
    expect(stored?.refreshToken).toBe("rt-new");
  });

  it("returns 401 and deletes session when refresh fails", async () => {
    const env = makeEnv();
    const nearExp = Math.floor(Date.now() / 1000) + 10;
    await putSession(env.DESK_KV, "sid-1", {
      accessToken: "at-old",
      refreshToken: "rt-bad",
      accessExp: nearExp,
    });
    await env.DESK_KV.put("wspc:client_id", "client-1");
    vi.spyOn(wspc, "refreshAccessToken").mockRejectedValue(new Error("invalid_grant"));

    const req = new Request("https://desk.yurenju.me/api/me", {
      headers: { Cookie: "__Host-Session=sid-1" },
    });
    const handler = vi.fn();
    const res = await withSession(req, env, handler);

    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(handler).not.toHaveBeenCalled();
    expect(await getSession(env.DESK_KV, "sid-1")).toBeNull();
  });
});
