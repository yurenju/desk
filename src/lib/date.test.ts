import { describe, it, expect } from "vitest";
import { isValidDateParam } from "./date";

describe("isValidDateParam", () => {
  it("returns true for a valid YYYY-MM-DD string", () => {
    expect(isValidDateParam("2026-05-31")).toBe(true);
  });

  it("returns false for 'garbage'", () => {
    expect(isValidDateParam("garbage")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidDateParam("")).toBe(false);
  });

  it("returns false for single-digit month/day (YYYY-M-D)", () => {
    expect(isValidDateParam("2026-5-1")).toBe(false);
  });
});
