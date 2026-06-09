import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeKvStub } from "../test-helpers/kv-stub";
import {
  putSession,
  getSession,
  getDevSessionId,
  getDevRefreshSeed,
  putDevRefreshSeed,
} from "../kv";
import { handleDevLogin } from "./dev-login";
import * as wspc from "../wspc";

function makeEnv(kv = makeKvStub()) {
  return { DESK_KV: kv } as unknown as { DESK_KV: KVNamespace };
}

const future = () => Math.floor(Date.now() / 1000) + 600;

beforeEach(() => vi.restoreAllMocks());

describe("POST /api/dev-login", () => {
  it("captures a live session carried by the cookie", async () => {
    const env = makeEnv();
    await putSession(env.DESK_KV, "real-sid", {
      accessToken: "at",
      refreshToken: "rt-1",
      accessExp: future(),
      userId: "usr_real",
    });
    const req = new Request("https://d/api/dev-login", {
      method: "POST",
      headers: { Cookie: "__Host-Session=real-sid" },
    });

    const res = await handleDevLogin(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { mode: string; refreshToken: string };
    expect(body.mode).toBe("capture");
    expect(body.refreshToken).toBe("rt-1");
    // Persists the canonical id + a wipe-recovery seed.
    expect(await getDevSessionId(env.DESK_KV)).toBe("real-sid");
    expect(await getDevRefreshSeed(env.DESK_KV)).toEqual({
      refreshToken: "rt-1",
      userId: "usr_real",
    });
  });

  it("reissues the cookie for a persisted dev session when no cookie is sent", async () => {
    const env = makeEnv();
    await putSession(env.DESK_KV, "real-sid", {
      accessToken: "at",
      refreshToken: "rt-1",
      accessExp: future(),
      userId: "usr_real",
    });
    // Prior capture remembered the id.
    await handleDevLogin(
      new Request("https://d/api/dev-login", {
        method: "POST",
        headers: { Cookie: "__Host-Session=real-sid" },
      }),
      env,
    );

    const res = await handleDevLogin(
      new Request("https://d/api/dev-login", { method: "POST" }),
      env,
    );
    expect(res.status).toBe(200);
    expect((await res.json() as { mode: string }).mode).toBe("reissue");
    expect(res.headers.get("Set-Cookie")).toContain("__Host-Session=real-sid");
  });

  it("mints a new session from the refresh seed after a KV session wipe", async () => {
    const env = makeEnv();
    await env.DESK_KV.put("wspc:client_id", "cli_1");
    await putDevRefreshSeed(env.DESK_KV, {
      refreshToken: "rt-seed",
      userId: "usr_real",
    });
    const spy = vi.spyOn(wspc, "refreshAccessToken").mockResolvedValue({
      accessToken: "at-new",
      refreshToken: "rt-rotated",
      expiresIn: 3600,
    });

    const res = await handleDevLogin(
      new Request("https://d/api/dev-login", { method: "POST" }),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { mode: string; sessionId: string };
    expect(body.mode).toBe("mint");
    expect(spy.mock.calls[0][0].refreshToken).toBe("rt-seed");
    // New session stored and cookie set; rotated token written back to the seed.
    const session = await getSession(env.DESK_KV, body.sessionId);
    expect(session?.accessToken).toBe("at-new");
    expect(res.headers.get("Set-Cookie")).toContain(`__Host-Session=${body.sessionId}`);
    expect(await getDevRefreshSeed(env.DESK_KV)).toEqual({
      refreshToken: "rt-rotated",
      userId: "usr_real",
    });
  });

  it("mints from the .dev.vars cold-start seed when KV holds nothing", async () => {
    const env = {
      DESK_KV: makeKvStub(),
      DEV_REFRESH_SEED: "rt-coldstart",
      DEV_USER_ID: "usr_real",
    } as unknown as {
      DESK_KV: KVNamespace;
      DEV_REFRESH_SEED: string;
      DEV_USER_ID: string;
    };
    await env.DESK_KV.put("wspc:client_id", "cli_1");
    const spy = vi.spyOn(wspc, "refreshAccessToken").mockResolvedValue({
      accessToken: "at-new",
      refreshToken: "rt-rotated",
      expiresIn: 3600,
    });

    const res = await handleDevLogin(
      new Request("https://d/api/dev-login", { method: "POST" }),
      env,
    );
    expect(res.status).toBe(200);
    expect((await res.json() as { mode: string }).mode).toBe("mint");
    expect(spy.mock.calls[0][0].refreshToken).toBe("rt-coldstart");
  });

  it("401s when there is no cookie, no saved session, and no seed", async () => {
    const env = makeEnv();
    const res = await handleDevLogin(
      new Request("https://d/api/dev-login", { method: "POST" }),
      env,
    );
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toBe("no_dev_session");
  });

  it("falls through to reissue/seed when the cookie points at a dead session", async () => {
    const env = makeEnv();
    // Cookie present but no matching session, and nothing saved -> 401.
    const res = await handleDevLogin(
      new Request("https://d/api/dev-login", {
        method: "POST",
        headers: { Cookie: "__Host-Session=ghost" },
      }),
      env,
    );
    expect(res.status).toBe(401);
  });
});
