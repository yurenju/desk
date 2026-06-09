import { describe, it, expect, vi, afterEach } from "vitest";
import { registerClient, requestDeviceAuthorization, exchangeDeviceCode, refreshAccessToken, getWhoami, listTodos, createTodo, patchTodo, listChildren } from "./wspc";

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

describe("exchangeDeviceCode", () => {
  it("returns { status: 'success', tokens } when WSPC issues tokens", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "at-1",
          token_type: "Bearer",
          expires_in: 900,
          refresh_token: "rt-1",
          scope: "wspc:full",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" });
    expect(result).toEqual({
      status: "success",
      tokens: {
        accessToken: "at-1",
        refreshToken: "rt-1",
        expiresIn: 900,
      },
    });
  });

  it("sends form-urlencoded body with device_code grant", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "authorization_pending" }), { status: 400 }),
    );
    await exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" });

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = init.body as URLSearchParams;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:device_code");
    expect(body.get("device_code")).toBe("dc-1");
    expect(body.get("client_id")).toBe("c1");
  });

  it("returns { status: 'pending' } on RFC 8628 string error authorization_pending", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "authorization_pending" }), { status: 400 }),
    );
    const result = await exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" });
    expect(result).toEqual({ status: "pending" });
  });

  it("returns { status: 'pending' } on WSPC envelope { error: { code: 'AUTHORIZATION_PENDING' } }", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "AUTHORIZATION_PENDING", message: "wait" } }),
        { status: 400 },
      ),
    );
    const result = await exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" });
    expect(result).toEqual({ status: "pending" });
  });

  it("returns { status: 'slow_down' } on slow_down (string form)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "slow_down" }), { status: 400 }),
    );
    const result = await exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" });
    expect(result).toEqual({ status: "slow_down" });
  });

  it("returns { status: 'slow_down' } on envelope form SLOW_DOWN", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "SLOW_DOWN" } }), { status: 400 }),
    );
    const result = await exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" });
    expect(result).toEqual({ status: "slow_down" });
  });

  it("returns { status: 'denied' } on access_denied", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "access_denied" }), { status: 400 }),
    );
    const result = await exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" });
    expect(result).toEqual({ status: "denied" });
  });

  it("returns { status: 'expired' } on expired_token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "expired_token" }), { status: 400 }),
    );
    const result = await exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" });
    expect(result).toEqual({ status: "expired" });
  });

  it("returns { status: 'expired' } on invalid_grant (consumed/revoked device_code)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
    );
    const result = await exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" });
    expect(result).toEqual({ status: "expired" });
  });

  it("throws on unknown error code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "weird_error" }), { status: 400 }),
    );
    await expect(
      exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" }),
    ).rejects.toThrow();
  });

  it("throws with status code if server returns non-JSON text on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Bad Gateway HTML", { status: 502 }),
    );
    await expect(
      exchangeDeviceCode({ clientId: "c1", deviceCode: "dc-1" }),
    ).rejects.toThrow("failed (status 502): Bad Gateway HTML");
  });
});

describe("refreshAccessToken", () => {
  it("POSTs form-urlencoded body with refresh_token grant and returns new tokens", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "at-2",
          token_type: "Bearer",
          expires_in: 900,
          refresh_token: "rt-2",
          scope: "wspc:full",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const tokens = await refreshAccessToken({ clientId: "c1", refreshToken: "rt-1" });
    expect(tokens).toEqual({ accessToken: "at-2", refreshToken: "rt-2", expiresIn: 900 });

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = init.body as URLSearchParams;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rt-1");
    expect(body.get("client_id")).toBe("c1");
  });

  it("throws when refresh fails (e.g. refresh_token expired)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
    );
    await expect(
      refreshAccessToken({ clientId: "c1", refreshToken: "rt-bad" }),
    ).rejects.toThrow();
  });

  it("throws with status code if server returns non-JSON text on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Internal Server Error HTML", { status: 500 }),
    );
    await expect(
      refreshAccessToken({ clientId: "c1", refreshToken: "rt-1" }),
    ).rejects.toThrow("failed (status 500): Internal Server Error HTML");
  });
});

describe("getWhoami", () => {
  it("GETs /auth/me with Bearer token and returns user info", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          user_id: "u-1",
          email: "test@example.com",
          display_name: "Test User",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const me = await getWhoami("at-1");
    expect(me).toEqual({
      userId: "u-1",
      email: "test@example.com",
      displayName: "Test User",
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.wspc.ai/auth/me",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer at-1" }),
      }),
    );
  });

  it("handles missing display_name (undefined)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ user_id: "u-1", email: "test@example.com" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const me = await getWhoami("at-1");
    expect(me.displayName).toBeUndefined();
  });

  it("throws on 401 (caller decides what to do)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("unauthorized", { status: 401 }),
    );
    await expect(getWhoami("at-bad")).rejects.toThrow();
  });

  it("throws when WSPC responds with invalid JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not a json string", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    await expect(getWhoami("at-1")).rejects.toThrow(
      "WSPC whoami failed to parse JSON response:"
    );
  });

  it("throws when WSPC responds with 200 OK but missing critical fields", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          display_name: "Test User",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await expect(getWhoami("at-1")).rejects.toThrow(
      "WSPC whoami response missing critical fields"
    );
  });

  it("throws with status code and body text on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Bad Gateway HTML", { status: 502 }),
    );
    await expect(getWhoami("at-1")).rejects.toThrow(
      "WSPC whoami failed (status 502): Bad Gateway HTML"
    );
  });
});

describe("listTodos", () => {
  it("listTodos queries project + type + statuses, no cf filter", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ todos: [] }), { status: 200 }),
    );
    await listTodos("at", { projectId: "prj_1", typeId: "typ_1" });
    const u = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(u.pathname).toBe("/todo/items");
    expect(u.searchParams.get("project_id")).toBe("prj_1");
    expect(u.searchParams.get("type_id")).toBe("typ_1");
    expect(u.searchParams.getAll("status")).toEqual(["open", "in_progress", "done"]);
    expect(fetchSpy.mock.calls[0][0] as string).not.toContain("cf.");
  });
});

describe("createTodo", () => {
  it("serialises camelCase body to snake_case fields", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ id: "tod_1", status: "open", title: "T", created_at: 0, updated_at: 0 }),
        { status: 200 },
      ),
    );
    await createTodo("at", {
      title: "T",
      projectId: "prj_1",
      typeId: "typ_1",
      customFields: { scheduled_dates: ["2026-05-31"] },
    });
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({
      title: "T",
      project_id: "prj_1",
      type_id: "typ_1",
      custom_fields: { scheduled_dates: ["2026-05-31"] },
    });
  });
});

describe("patchTodo", () => {
  it("maps status + customFields and supports null clear", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "tod_1", status: "open" }), { status: 200 }),
    );
    await patchTodo("at", "tod_1", { customFields: { daily_priority: null } });
    const init = fetchSpy.mock.calls[0][1]!;
    expect(JSON.parse(init.body as string)).toEqual({
      custom_fields: { daily_priority: null },
    });
    expect(init.method).toBe("PATCH");
  });

  it("sends title as a top-level field when provided", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "tod_1", status: "open" }), { status: 200 }),
    );
    await patchTodo("at", "tod_1", { title: "New" });
    const init = fetchSpy.mock.calls[0][1]!;
    expect(JSON.parse(init.body as string)).toEqual({ title: "New" });
    expect(init.method).toBe("PATCH");
  });
});

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status: ok ? status : status }),
  );
}

describe("listChildren", () => {
  it("requests children of a parent scoped to project+type, non-cancelled", async () => {
    const spy = mockFetchOnce({ todos: [{ id: "c1", status: "open", title: "step", created_at: 0, updated_at: 0 }] });
    const out = await listChildren("at", { projectId: "p1", typeId: "t1", parentId: "tod_1" });
    expect(out).toHaveLength(1);
    const url = (spy.mock.calls[0][0] as string);
    expect(url).toContain("parent_id=tod_1");
    expect(url).toContain("project_id=p1");
    expect(url).toContain("type_id=t1");
    expect(url).toContain("status=open");
  });
});

describe("createTodo with parentId", () => {
  it("sends parent_id in the body when given", async () => {
    const spy = mockFetchOnce({ id: "c2", status: "open", title: "sub", created_at: 0, updated_at: 0 });
    await createTodo("at", { title: "sub", projectId: "p1", typeId: "t1", customFields: {}, parentId: "tod_1" });
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toMatchObject({ parent_id: "tod_1", title: "sub" });
  });
});

describe("patchTodo with description", () => {
  it("sends description in the payload when given", async () => {
    const spy = mockFetchOnce({ id: "tod_1", status: "open", title: "x", created_at: 0, updated_at: 0 });
    await patchTodo("at", "tod_1", { description: "**hi**" });
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ description: "**hi**" });
  });
});
