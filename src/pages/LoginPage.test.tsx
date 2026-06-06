import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginPage } from "./LoginPage";

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetchSequence(responses: Array<Response | Promise<Response>>) {
  let i = 0;
  return vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return r instanceof Promise ? r : r;
  });
}

describe("LoginPage", () => {
  it("renders user_code and verification link after /api/auth/login resolves", async () => {
    mockFetchSequence([
      new Response(
        JSON.stringify({
          verification_uri_complete: "https://app.wspc.ai/device?user_code=ABCD",
          user_code: "ABCD-1234",
          polling_id: "pid-1",
          interval: 5,
          expires_in: 600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
      new Response(JSON.stringify({ state: "pending" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ]);

    render(<LoginPage onAuthenticated={() => {}} />);

    expect(await screen.findByText("ABCD-1234")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /在 WSPC 開啟授權頁/ }),
    ).toHaveAttribute("href", "https://app.wspc.ai/device?user_code=ABCD");
  });

  it("calls onAuthenticated when polling returns 'authenticated'", async () => {
    vi.useFakeTimers();
    mockFetchSequence([
      new Response(
        JSON.stringify({
          verification_uri_complete: "https://app.wspc.ai/device?user_code=ABCD",
          user_code: "ABCD",
          polling_id: "pid-1",
          interval: 1,
          expires_in: 600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
      new Response(JSON.stringify({ state: "authenticated" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ]);

    const onAuthenticated = vi.fn();
    render(<LoginPage onAuthenticated={onAuthenticated} />);

    await vi.runAllTimersAsync();
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalled());

    vi.useRealTimers();
  });

  it("shows error message when polling returns 'denied'", async () => {
    vi.useFakeTimers();
    mockFetchSequence([
      new Response(
        JSON.stringify({
          verification_uri_complete: "https://app.wspc.ai/device",
          user_code: "ABCD",
          polling_id: "pid-1",
          interval: 1,
          expires_in: 600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
      new Response(JSON.stringify({ state: "denied" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ]);

    render(<LoginPage onAuthenticated={() => {}} />);
    await vi.runAllTimersAsync();
    expect(await screen.findByText(/已被拒絕/)).toBeInTheDocument();
    // denied surfaces a restart action.
    expect(
      screen.getByRole("button", { name: /重新登入/ }),
    ).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows expired state with a 'restart' action that re-initiates device flow", async () => {
    vi.useFakeTimers();
    const fetchSpy = mockFetchSequence([
      new Response(
        JSON.stringify({
          verification_uri_complete: "https://app.wspc.ai/device?user_code=ABCD",
          user_code: "ABCD",
          polling_id: "pid-1",
          interval: 1,
          expires_in: 600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
      new Response(JSON.stringify({ state: "expired" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
      new Response(
        JSON.stringify({
          verification_uri_complete: "https://app.wspc.ai/device?user_code=WXYZ",
          user_code: "WXYZ",
          polling_id: "pid-2",
          interval: 1,
          expires_in: 600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
      new Response(JSON.stringify({ state: "pending" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ]);
    render(<LoginPage onAuthenticated={() => {}} />);
    await vi.runAllTimersAsync();
    expect(await screen.findByText(/已過期/)).toBeInTheDocument();
    vi.useRealTimers();
    const restart = screen.getByRole("button", { name: /重新產生驗證碼/ });
    // Count login POSTs before the click so we can prove restart re-POSTs.
    const loginCallsBefore = fetchSpy.mock.calls.filter(
      (c) => String(c[0]).includes("/api/auth/login") && c[1]?.method === "POST",
    ).length;
    await userEvent.setup().click(restart);
    // restart() re-initiates the flow: a new login POST fires and the second
    // login response's user_code surfaces in the DOM.
    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.filter(
          (c) =>
            String(c[0]).includes("/api/auth/login") && c[1]?.method === "POST",
        ).length,
      ).toBeGreaterThan(loginCallsBefore),
    );
    expect(await screen.findByText("WXYZ")).toBeInTheDocument();
  });

  it("shows error and stops polling when a status poll returns a non-OK response", async () => {
    vi.useFakeTimers();
    const fetchSpy = mockFetchSequence([
      new Response(
        JSON.stringify({
          verification_uri_complete: "https://app.wspc.ai/device",
          user_code: "ABCD",
          polling_id: "pid-1",
          interval: 1,
          expires_in: 600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
      // Infra failure: non-JSON 500 body. Reading it as JSON would throw.
      new Response("<html>internal error</html>", { status: 500 }),
    ]);

    render(<LoginPage onAuthenticated={() => {}} />);
    await vi.runAllTimersAsync();

    expect(await screen.findByText(/系統錯誤/)).toBeInTheDocument();
    // One login POST + exactly one status poll, then polling stops.
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
