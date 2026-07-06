import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import * as api from "@/lib/api/todo";
import { useComments } from "./useComments";

const c1 = { id: "c1", content: "hi", created_at: "2026-07-01T00:00:00.000Z", updated_at: "2026-07-01T00:00:00.000Z" };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useComments", () => {
  it("loads comments for the given task", async () => {
    vi.spyOn(api, "fetchComments").mockResolvedValue([c1]);
    const { result } = renderHook(() => useComments("t1"));
    await waitFor(() => expect(result.current.comments).toHaveLength(1));
    expect(result.current.status).toBe("ready");
  });

  it("reports error status when the fetch fails", async () => {
    vi.spyOn(api, "fetchComments").mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useComments("t1"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.comments).toHaveLength(0);
  });

  it("appends a comment after the server assigns its id", async () => {
    vi.spyOn(api, "fetchComments").mockResolvedValue([]);
    vi.spyOn(api, "createComment").mockResolvedValue({ ...c1, id: "c9", content: "new" });
    const { result } = renderHook(() => useComments("t1"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(async () => { await result.current.add("new"); });
    expect(result.current.comments.map((c) => c.id)).toContain("c9");
  });

  it("edits a comment optimistically and keeps the server value", async () => {
    vi.spyOn(api, "fetchComments").mockResolvedValue([c1]);
    const updated = { ...c1, content: "changed", updated_at: "2026-07-02T00:00:00.000Z" };
    vi.spyOn(api, "updateComment").mockResolvedValue(updated);
    const { result } = renderHook(() => useComments("t1"));
    await waitFor(() => expect(result.current.comments).toHaveLength(1));
    await act(async () => { await result.current.edit("c1", "changed"); });
    expect(result.current.comments[0]).toEqual(updated);
  });

  it("rolls back an edit when the API fails", async () => {
    vi.spyOn(api, "fetchComments").mockResolvedValue([c1]);
    vi.spyOn(api, "updateComment").mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useComments("t1"));
    await waitFor(() => expect(result.current.comments).toHaveLength(1));
    await act(async () => { await result.current.edit("c1", "changed"); });
    expect(result.current.comments[0]).toEqual(c1);
  });

  it("removes a comment optimistically and rolls back on failure", async () => {
    vi.spyOn(api, "fetchComments").mockResolvedValue([c1]);
    vi.spyOn(api, "deleteComment").mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useComments("t1"));
    await waitFor(() => expect(result.current.comments).toHaveLength(1));
    await act(async () => { await result.current.remove("c1"); });
    expect(result.current.comments).toHaveLength(1);
  });

  it("removes a comment when the API succeeds", async () => {
    vi.spyOn(api, "fetchComments").mockResolvedValue([c1]);
    vi.spyOn(api, "deleteComment").mockResolvedValue();
    const { result } = renderHook(() => useComments("t1"));
    await waitFor(() => expect(result.current.comments).toHaveLength(1));
    await act(async () => { await result.current.remove("c1"); });
    expect(result.current.comments).toHaveLength(0);
  });
});
