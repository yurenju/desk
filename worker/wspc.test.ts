import { describe, it, expect, vi, afterEach } from "vitest";
import { registerClient } from "./wspc";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registerClient", () => {
  it("POSTs to /auth/oauth/register with required fields and returns client_id", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          client_id: "test-client-id",
          client_name: "desk.yurenju.me",
          redirect_uris: ["https://desk.yurenju.me/login"],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const clientId = await registerClient({
      clientName: "desk.yurenju.me",
      redirectUris: ["https://desk.yurenju.me/login"],
    });

    expect(clientId).toBe("test-client-id");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.wspc.ai/auth/oauth/register",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({
      client_name: "desk.yurenju.me",
      redirect_uris: ["https://desk.yurenju.me/login"],
      token_endpoint_auth_method: "none",
      grant_types: [
        "refresh_token",
        "urn:ietf:params:oauth:grant-type:device_code",
      ],
    });
  });

  it("throws when WSPC responds non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("internal error", { status: 500 }),
    );
    await expect(
      registerClient({ clientName: "x", redirectUris: ["https://x"] }),
    ).rejects.toThrow();
  });

  it("throws when WSPC responds with 200 OK but missing client_id", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          client_name: "desk.yurenju.me",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      registerClient({ clientName: "x", redirectUris: ["https://x"] }),
    ).rejects.toThrow("WSPC register response missing client_id");
  });
});
