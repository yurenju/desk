import { describe, it, expect, vi, afterEach } from "vitest";
import { registerClient, requestDeviceAuthorization } from "./wspc";

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

  it("throws when WSPC responds with invalid JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not a json string", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    await expect(
      registerClient({ clientName: "x", redirectUris: ["https://x"] }),
    ).rejects.toThrow("WSPC register failed to parse JSON response:");
  });

  it("throws when WSPC responds with 200 OK but null JSON response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    await expect(
      registerClient({ clientName: "x", redirectUris: ["https://x"] }),
    ).rejects.toThrow("WSPC register response missing client_id");
  });
});

describe("requestDeviceAuthorization", () => {
  it("POSTs to /auth/oauth/device with form-urlencoded client_id and returns device flow info", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          device_code: "dev-code",
          user_code: "ABCD-1234",
          verification_uri: "https://app.wspc.ai/device",
          verification_uri_complete: "https://app.wspc.ai/device?user_code=ABCD-1234",
          expires_in: 600,
          interval: 5,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await requestDeviceAuthorization("client-123");

    expect(result).toEqual({
      deviceCode: "dev-code",
      userCode: "ABCD-1234",
      verificationUri: "https://app.wspc.ai/device",
      verificationUriComplete: "https://app.wspc.ai/device?user_code=ABCD-1234",
      expiresIn: 600,
      interval: 5,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.wspc.ai/auth/oauth/device",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/x-www-form-urlencoded",
        }),
      }),
    );

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = init.body as URLSearchParams;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body.get("client_id")).toBe("client-123");
  });

  it("throws when WSPC responds non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("device auth failed", { status: 400 }),
    );
    await expect(requestDeviceAuthorization("client-123")).rejects.toThrow(
      "WSPC device authorization failed: 400 device auth failed",
    );
  });

  it("throws when WSPC responds with invalid JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not a json string", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    await expect(requestDeviceAuthorization("client-123")).rejects.toThrow(
      "WSPC device authorization failed to parse JSON response:",
    );
  });

  it("throws when WSPC responds with 200 OK but missing critical fields", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          device_code: "dev-code",
          // missing other required fields
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(requestDeviceAuthorization("client-123")).rejects.toThrow(
      "WSPC device authorization response missing critical fields",
    );
  });

  it("throws when WSPC responds with 200 OK but null JSON response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(null), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    await expect(requestDeviceAuthorization("c1")).rejects.toThrow(
      "WSPC device authorization response missing critical fields"
    );
  });
});
