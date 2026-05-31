import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
    expect(await screen.findByText(/已拒絕|登入失敗/)).toBeInTheDocument();
    vi.useRealTimers();
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
