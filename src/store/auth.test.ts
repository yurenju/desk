import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "./auth";

beforeEach(() => {
  useAuthStore.setState({ me: null, status: "loading" });
  vi.restoreAllMocks();
});

describe("useAuthStore", () => {
  it("starts with status 'loading' and me null", () => {
    expect(useAuthStore.getState().status).toBe("loading");
    expect(useAuthStore.getState().me).toBeNull();
  });

  it("setMe updates me and flips status to authenticated", () => {
    useAuthStore.getState().setMe({
      userId: "u-1",
      email: "a@b",
      displayName: "A",
    });
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().me?.userId).toBe("u-1");
  });

  it("clear resets to unauthenticated", () => {
    useAuthStore.getState().setMe({ userId: "u-1", email: "a@b" });
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().me).toBeNull();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });

  it("fetchMe calls /api/me; on 200 sets me", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          user_id: "u-1",
          email: "a@b",
          display_name: "A",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await useAuthStore.getState().fetchMe();
    expect(fetchSpy).toHaveBeenCalledWith("/api/me", expect.any(Object));
    expect(useAuthStore.getState().me).toEqual({
      userId: "u-1",
      email: "a@b",
      displayName: "A",
    });
    expect(useAuthStore.getState().status).toBe("authenticated");
  });

  it("fetchMe sets status 'unauthenticated' on 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
    await useAuthStore.getState().fetchMe();
    expect(useAuthStore.getState().me).toBeNull();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });
});
