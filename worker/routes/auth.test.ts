import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeKvStub } from "../test-helpers/kv-stub";
import { handleLogin, handleStatus, handleLogout } from "./auth";
import { getDevice, putDevice, getSession, putSession } from "../kv";
import * as wspc from "../wspc";

function makeEnv(kv = makeKvStub()) {
  return { DESK_KV: kv } as unknown as { DESK_KV: KVNamespace };
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

describe("GET /api/auth/status", () => {
  it("returns 'expired' when polling_id is not found in KV", async () => {
    const env = makeEnv();
    const res = await handleStatus(env, "ghost-id");
    const body = (await res.json()) as { state: string };
    expect(body.state).toBe("expired");
  });

  it("returns 'pending' when WSPC says authorization_pending", async () => {
    const env = makeEnv();
    await env.DESK_KV.put("wspc:client_id", "client-1");
    await putDevice(env.DESK_KV, "pid-1", { deviceCode: "dc", interval: 5 }, 600);
    vi.spyOn(wspc, "exchangeDeviceCode").mockResolvedValue({ status: "pending" });

    const res = await handleStatus(env, "pid-1");
    expect((await res.json())).toEqual({ state: "pending" });
  });

  it("returns 'pending' + slow_down hint", async () => {
    const env = makeEnv();
    await env.DESK_KV.put("wspc:client_id", "client-1");
    await putDevice(env.DESK_KV, "pid-1", { deviceCode: "dc", interval: 5 }, 600);
    vi.spyOn(wspc, "exchangeDeviceCode").mockResolvedValue({ status: "slow_down" });

    const res = await handleStatus(env, "pid-1");
    expect((await res.json())).toEqual({ state: "pending", slow_down: true });
  });

  it("returns 'authenticated', creates session, sets cookie, deletes device entry", async () => {
    const env = makeEnv();
    await env.DESK_KV.put("wspc:client_id", "client-1");
    await putDevice(env.DESK_KV, "pid-1", { deviceCode: "dc", interval: 5 }, 600);
    vi.spyOn(wspc, "exchangeDeviceCode").mockResolvedValue({
      status: "success",
      tokens: { accessToken: "at-1", refreshToken: "rt-1", expiresIn: 900 },
    });

    const res = await handleStatus(env, "pid-1");
    expect(res.status).toBe(200);
    expect((await res.json())).toEqual({ state: "authenticated" });

    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("__Host-Session=");
    expect(setCookie).toContain("HttpOnly");

    const cookieMatch = setCookie!.match(/__Host-Session=([^;]+)/);
    const sessionId = cookieMatch![1];
    const session = await getSession(env.DESK_KV, sessionId);
    expect(session?.accessToken).toBe("at-1");
    expect(session?.refreshToken).toBe("rt-1");

    expect(await getDevice(env.DESK_KV, "pid-1")).toBeNull();
  });

  it("returns 'denied' and deletes device entry", async () => {
    const env = makeEnv();
    await env.DESK_KV.put("wspc:client_id", "client-1");
    await putDevice(env.DESK_KV, "pid-1", { deviceCode: "dc", interval: 5 }, 600);
    vi.spyOn(wspc, "exchangeDeviceCode").mockResolvedValue({ status: "denied" });

    const res = await handleStatus(env, "pid-1");
    expect((await res.json())).toEqual({ state: "denied" });
    expect(await getDevice(env.DESK_KV, "pid-1")).toBeNull();
  });

  it("returns 'expired' and deletes device entry when WSPC says expired_token", async () => {
    const env = makeEnv();
    await env.DESK_KV.put("wspc:client_id", "client-1");
    await putDevice(env.DESK_KV, "pid-1", { deviceCode: "dc", interval: 5 }, 600);
    vi.spyOn(wspc, "exchangeDeviceCode").mockResolvedValue({ status: "expired" });

    const res = await handleStatus(env, "pid-1");
    expect((await res.json())).toEqual({ state: "expired" });
    expect(await getDevice(env.DESK_KV, "pid-1")).toBeNull();
  });
});

describe("POST /api/auth/logout", () => {
  it("deletes session from KV and clears cookie", async () => {
    const env = makeEnv();
    await putSession(env.DESK_KV, "sid-1", {
      accessToken: "at",
      refreshToken: "rt",
      accessExp: 999999,
    });

    const req = new Request("https://desk.yurenju.me/api/auth/logout", {
      method: "POST",
      headers: { Cookie: "__Host-Session=sid-1" },
    });

    const res = await handleLogout(req, env);
    expect(res.status).toBe(204);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(await getSession(env.DESK_KV, "sid-1")).toBeNull();
  });

  it("clears cookie even when no session existed (idempotent)", async () => {
    const env = makeEnv();
    const req = new Request("https://desk.yurenju.me/api/auth/logout", {
      method: "POST",
      headers: { Cookie: "__Host-Session=ghost" },
    });
    const res = await handleLogout(req, env);
    expect(res.status).toBe(204);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("returns 204 and clears cookie when no cookie present", async () => {
    const env = makeEnv();
    const req = new Request("https://desk.yurenju.me/api/auth/logout", {
      method: "POST",
    });
    const res = await handleLogout(req, env);
    expect(res.status).toBe(204);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
});
