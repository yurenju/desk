import { describe, it, expect } from "vitest";
import { isValidDateParam, weekOf, isValidMonthParam, prevMonth, nextMonth } from "./date";

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

describe("month helpers", () => {
  it("isValidMonthParam accepts YYYY-MM, rejects others", () => {
    expect(isValidMonthParam("2026-05")).toBe(true);
    expect(isValidMonthParam("2026-5")).toBe(false);
    expect(isValidMonthParam("2026-05-01")).toBe(false);
    expect(isValidMonthParam("garbage")).toBe(false);
  });

  it("prevMonth / nextMonth step with year rollover", () => {
    expect(prevMonth("2026-05")).toBe("2026-04");
    expect(nextMonth("2026-05")).toBe("2026-06");
    expect(prevMonth("2026-01")).toBe("2025-12");
    expect(nextMonth("2026-12")).toBe("2027-01");
  });
});

describe("weekOf (Sunday start)", () => {
  it("returns Sun..Sat for a Saturday", () => {
    // 2026-06-06 is Saturday → Sunday-start week is 2026-05-31 .. 2026-06-06
    const r = weekOf("2026-06-06");
    expect(r).toEqual([
      "2026-05-31",
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
    ]);
  });

  it("returns the same week for the Sunday itself", () => {
    // 2026-05-31 is Sunday
    const r = weekOf("2026-05-31");
    expect(r[0]).toBe("2026-05-31");
    expect(r[6]).toBe("2026-06-06");
  });

  it("crosses a month boundary correctly", () => {
    // 2026-06-02 is Tuesday → week is 2026-05-31 .. 2026-06-06
    const r = weekOf("2026-06-02");
    expect(r[0]).toBe("2026-05-31");
    expect(r).toHaveLength(7);
  });
});
