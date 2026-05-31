import { describe, it, expect, vi } from "vitest";
import { makeKvStub } from "./test-helpers/kv-stub";
import { getClientId, ensureClientId } from "./kv";
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


