import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeKvStub } from "./test-helpers/kv-stub";
import { ensureBootstrap } from "./bootstrap";
import * as wspc from "./wspc";

beforeEach(() => vi.restoreAllMocks());

describe("ensureBootstrap", () => {
  it("creates project + type on KV miss and caches per user", async () => {
    const kv = makeKvStub();
    const projectSpy = vi.spyOn(wspc, "createProject").mockResolvedValue({ id: "prj_1" });
    const typeSpy = vi.spyOn(wspc, "createTodoType").mockResolvedValue({ id: "typ_1" });

    const out = await ensureBootstrap(kv, "at", "usr_a");
    expect(out).toEqual({ projectId: "prj_1", typeId: "typ_1" });
    expect(await kv.get("desk:bootstrap:usr_a")).toContain("prj_1");

    const out2 = await ensureBootstrap(kv, "at", "usr_a");
    expect(out2).toEqual({ projectId: "prj_1", typeId: "typ_1" });
    expect(projectSpy).toHaveBeenCalledTimes(1);
    expect(typeSpy).toHaveBeenCalledTimes(1);
  });

  it("bootstraps a different user independently", async () => {
    const kv = makeKvStub();
    vi.spyOn(wspc, "createProject").mockResolvedValue({ id: "prj_b" });
    vi.spyOn(wspc, "createTodoType").mockResolvedValue({ id: "typ_b" });
    const out = await ensureBootstrap(kv, "at", "usr_b");
    expect(out).toEqual({ projectId: "prj_b", typeId: "typ_b" });
    expect(await kv.get("desk:bootstrap:usr_a")).toBeNull();
  });
});
