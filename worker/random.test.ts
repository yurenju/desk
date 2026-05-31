import { describe, it, expect } from "vitest";
import { randomBase64UrlId } from "./random";

describe("randomBase64UrlId", () => {
  it("returns a 43-character base64url string for 32 bytes input", () => {
    const id = randomBase64UrlId(32);
    expect(id).toHaveLength(43);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces different values across calls", () => {
    const a = randomBase64UrlId(32);
    const b = randomBase64UrlId(32);
    expect(a).not.toBe(b);
  });
});
