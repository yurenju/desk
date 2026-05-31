import { describe, it, expect, vi } from "vitest";
import { makeKvStub } from "./test-helpers/kv-stub";
import { getClientId, ensureClientId, getSession, putSession, deleteSession, getDevice, putDevice, deleteDevice } from "./kv";
import * as wspc from "./wspc";

describe("getClientId", () => {
  it("returns the value from KV when present", async () => {
    const kv = makeKvStub();
    await kv.put("wspc:client_id", "cached-id");
    expect(await getClientId(kv)).toBe("cached-id");
  });

  it("returns null when KV is empty", async () => {
    const kv = makeKvStub();
    expect(await getClientId(kv)).toBeNull();
  });
});

describe("ensureClientId", () => {
  const testConfig = {
    clientName: "test-client",
    redirectUris: ["https://test-client.me/login"],
  };

  it("returns cached id without calling register", async () => {
    const kv = makeKvStub();
    await kv.put("wspc:client_id", "cached-id");
    const spy = vi.spyOn(wspc, "registerClient");
    expect(await ensureClientId(kv, testConfig)).toBe("cached-id");
    expect(spy).not.toHaveBeenCalled();
  });

  it("registers a new client and caches it when KV is empty", async () => {
    const kv = makeKvStub();
    const spy = vi.spyOn(wspc, "registerClient").mockResolvedValue("new-id");
    const result = await ensureClientId(kv, testConfig);
    expect(result).toBe("new-id");
    expect(await kv.get("wspc:client_id")).toBe("new-id");
    expect(spy).toHaveBeenCalledWith(testConfig);
  });

  it("propagates registration error if registerClient fails", async () => {
    const kv = makeKvStub();
    vi.spyOn(wspc, "registerClient").mockRejectedValue(new Error("Network Error"));
    await expect(ensureClientId(kv, testConfig)).rejects.toThrow("Network Error");
  });
});

describe("makeKvStub proxy", () => {
  it("throws an error when accessing an unimplemented KVNamespace property/method", () => {
    const kv = makeKvStub();
    expect(() => (kv as unknown as { list: () => unknown }).list()).toThrow(
      "Unimplemented KVNamespace property/method accessed: list"
    );
  });

  it("does not throw when accessing then, toJSON, or symbol properties", () => {
    const kv = makeKvStub();
    expect((kv as unknown as Record<string, unknown>).then).toBeUndefined();
    expect((kv as unknown as Record<string, unknown>).toJSON).toBeUndefined();
    expect((kv as unknown as Record<symbol, unknown>)[Symbol.toStringTag]).toBeUndefined();
  });
});

describe("session operations", () => {
  it("putSession writes JSON with 30-day TTL, getSession reads it back", async () => {
    const kv = makeKvStub();
    const session = {
      accessToken: "at-1",
      refreshToken: "rt-1",
      accessExp: 1234567890,
      userId: "usr_test",
    };
    await putSession(kv, "sid-1", session);

    const raw = await kv.get("session:sid-1");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual(session);

    expect(await getSession(kv, "sid-1")).toEqual(session);
  });

  it("getSession returns null when not present", async () => {
    const kv = makeKvStub();
    expect(await getSession(kv, "missing")).toBeNull();
  });

  it("getSession returns null when JSON parse fails", async () => {
    const kv = makeKvStub();
    await kv.put("session:bad", "not-json{");
    expect(await getSession(kv, "bad")).toBeNull();
  });

  it("deleteSession removes the entry", async () => {
    const kv = makeKvStub();
    await putSession(kv, "sid-1", {
      accessToken: "at",
      refreshToken: "rt",
      accessExp: 1,
      userId: "usr_test",
    });
    await deleteSession(kv, "sid-1");
    expect(await getSession(kv, "sid-1")).toBeNull();
  });
});

describe("device polling operations", () => {
  it("putDevice writes JSON with custom TTL", async () => {
    const kv = makeKvStub();
    await putDevice(
      kv,
      "pid-1",
      { deviceCode: "dc-1", interval: 5 },
      600,
    );
    expect(await getDevice(kv, "pid-1")).toEqual({
      deviceCode: "dc-1",
      interval: 5,
    });
  });

  it("getDevice returns null when missing", async () => {
    const kv = makeKvStub();
    expect(await getDevice(kv, "missing")).toBeNull();
  });

  it("deleteDevice removes the entry", async () => {
    const kv = makeKvStub();
    await putDevice(kv, "pid-1", { deviceCode: "dc", interval: 5 }, 600);
    await deleteDevice(kv, "pid-1");
    expect(await getDevice(kv, "pid-1")).toBeNull();
  });
});
