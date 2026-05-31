import { describe, it, expect } from "vitest";
import { parseSessionId, serializeSessionCookie, clearSessionCookie } from "./cookie";

describe("parseSessionId", () => {
  it("returns the session id when cookie is present", () => {
    const headers = new Headers({ Cookie: "__Host-Session=abc123; theme=light" });
    expect(parseSessionId(headers)).toBe("abc123");
  });

  it("returns null when Cookie header is missing", () => {
    const headers = new Headers();
    expect(parseSessionId(headers)).toBeNull();
  });

  it("returns null when __Host-Session is not present", () => {
    const headers = new Headers({ Cookie: "theme=light" });
    expect(parseSessionId(headers)).toBeNull();
  });

  it("returns the session id when located at the end of Cookie header", () => {
    const headers = new Headers({ Cookie: "theme=light; __Host-Session=abc123" });
    expect(parseSessionId(headers)).toBe("abc123");
  });

  it("returns the session id even if wrapped in double quotes", () => {
    const headers = new Headers({ Cookie: '__Host-Session="abc123"' });
    expect(parseSessionId(headers)).toBe("abc123");
  });

  it("returns null when cookie value is empty", () => {
    const headers = new Headers({ Cookie: "__Host-Session=" });
    expect(parseSessionId(headers)).toBeNull();
  });

  it("does not match suffix keys or partial names", () => {
    const headers = new Headers({ Cookie: "Not-__Host-Session=abc; __Host-Session-Extra=xyz" });
    expect(parseSessionId(headers)).toBeNull();
  });

  it("reconstructs values that contain equals sign", () => {
    const headers = new Headers({ Cookie: "__Host-Session=abc=123" });
    expect(parseSessionId(headers)).toBe("abc=123");
  });
});

describe("serializeSessionCookie", () => {
  it("includes all required attributes", () => {
    const cookie = serializeSessionCookie("abc123");
    expect(cookie).toContain("__Host-Session=abc123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=2592000");
  });

  it("serializeSessionCookie throws error on invalid characters", () => {
    expect(() => serializeSessionCookie("abc;123")).toThrow("Invalid session ID format");
  });
});

describe("clearSessionCookie", () => {
  it("sets Max-Age=0 to clear the cookie", () => {
    const cookie = clearSessionCookie();
    expect(cookie).toContain("__Host-Session=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("Path=/");
  });
});

