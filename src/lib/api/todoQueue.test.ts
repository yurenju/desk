import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Task } from "@/lib/types";
import * as api from "./todo";
import { enqueuePatch, resetTodoQueue } from "./todoQueue";

beforeEach(() => {
  vi.restoreAllMocks();
  resetTodoQueue();
});

describe("todoQueue", () => {
  it("sends a single patch immediately and resolves with the task", async () => {
    const spy = vi
      .spyOn(api, "patchTodoApi")
      .mockResolvedValue({ id: "a" } as Task);
    const task = await enqueuePatch("a", { daily_priority: "1" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("a", { daily_priority: "1" });
    expect(task).toEqual({ id: "a" });
  });

  it("merges patches enqueued while a request is in flight into one follow-up", async () => {
    let resolve1!: (t: Task) => void;
    const p1 = new Promise<Task>((r) => {
      resolve1 = r;
    });
    const spy = vi
      .spyOn(api, "patchTodoApi")
      .mockReturnValueOnce(p1)
      .mockResolvedValueOnce({ id: "a", v: 2 } as unknown as Task);

    const c1 = enqueuePatch("a", { daily_priority: "1" });
    const c2 = enqueuePatch("a", { daily_priority: "2" });
    const c3 = enqueuePatch("a", { status: "done" });

    expect(spy).toHaveBeenCalledTimes(1);

    resolve1({ id: "a", v: 1 } as unknown as Task);
    await c1;
    const [r2, r3] = await Promise.all([c2, c3]);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(2, "a", {
      daily_priority: "2",
      status: "done",
    });
    expect(r2).toEqual({ id: "a", v: 2 });
    expect(r3).toEqual({ id: "a", v: 2 });
  });

  it("later value wins when the same field is enqueued repeatedly", async () => {
    let resolve1!: (t: Task) => void;
    const p1 = new Promise<Task>((r) => {
      resolve1 = r;
    });
    const spy = vi
      .spyOn(api, "patchTodoApi")
      .mockReturnValueOnce(p1)
      .mockResolvedValueOnce({ id: "a" } as Task);

    const c1 = enqueuePatch("a", { daily_priority: "1" });
    const c2 = enqueuePatch("a", { daily_priority: "2" });
    const c3 = enqueuePatch("a", { daily_priority: "3" });

    resolve1({ id: "a" } as Task);
    await Promise.all([c1, c2, c3]);

    expect(spy).toHaveBeenNthCalledWith(2, "a", { daily_priority: "3" });
  });

  it("sends different ids concurrently without blocking each other", async () => {
    let resolveA!: (t: Task) => void;
    const pA = new Promise<Task>((r) => {
      resolveA = r;
    });
    const spy = vi
      .spyOn(api, "patchTodoApi")
      .mockReturnValueOnce(pA)
      .mockResolvedValueOnce({ id: "b" } as Task);

    const ca = enqueuePatch("a", { daily_priority: "1" });
    const cb = await enqueuePatch("b", { daily_priority: "1" });

    expect(cb).toEqual({ id: "b" });
    expect(spy).toHaveBeenCalledTimes(2);

    resolveA({ id: "a" } as Task);
    await ca;
  });

  it("rejects the in-flight caller and all coalesced waiters when a request fails", async () => {
    let reject1!: (err: unknown) => void;
    const p1 = new Promise<Task>((_, rej) => {
      reject1 = rej;
    });
    vi.spyOn(api, "patchTodoApi").mockReturnValueOnce(p1);

    const c1 = enqueuePatch("a", { daily_priority: "1" });
    const c2 = enqueuePatch("a", { daily_priority: "2" });

    reject1(new Error("boom"));

    await expect(c1).rejects.toThrow("boom");
    await expect(c2).rejects.toThrow("boom");
  });

  it("recovers for the same id after a failure (queue state is cleared)", async () => {
    vi.spyOn(api, "patchTodoApi").mockRejectedValueOnce(new Error("boom"));
    await expect(enqueuePatch("a", { daily_priority: "1" })).rejects.toThrow(
      "boom",
    );

    const spy = vi
      .spyOn(api, "patchTodoApi")
      .mockResolvedValue({ id: "a" } as Task);
    const task = await enqueuePatch("a", { daily_priority: "2" });
    expect(task).toEqual({ id: "a" });
    expect(spy).toHaveBeenCalledWith("a", { daily_priority: "2" });
  });
});
