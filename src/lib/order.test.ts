import { describe, it, expect } from "vitest";
import { midpoint } from "./order";

describe("midpoint", () => {
  it("returns a key after a when b is null", () => {
    expect(midpoint("a", null) > "a").toBe(true);
  });
  it("returns a key before b when a is null", () => {
    expect(midpoint(null, "n") < "n").toBe(true);
  });
  it("returns a key strictly between a and b", () => {
    const m = midpoint("a", "c");
    expect(m > "a" && m < "c").toBe(true);
  });
  it("subdivides repeatedly while staying ordered", () => {
    let lo = "a";
    const hi = "b";
    let prev = lo;
    for (let i = 0; i < 50; i++) {
      const m = midpoint(lo, hi);
      expect(m > prev && m < hi).toBe(true);
      prev = m;
      lo = m;
    }
  });
  it("handles adjacent keys by extending length", () => {
    const m = midpoint("ab", "ac");
    expect(m > "ab" && m < "ac").toBe(true);
  });
  it("returns a default first key when both null", () => {
    const m = midpoint(null, null);
    expect(typeof m).toBe("string");
    expect(m.length).toBeGreaterThan(0);
  });
});
