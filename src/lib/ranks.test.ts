import { describe, it, expect } from "vitest";
import { parseRanks, encodeRanks, rankOn, writeRank } from "./ranks";

describe("parseRanks / encodeRanks", () => {
  it("parses 'key:rank' entries and skips malformed ones", () => {
    const m = parseRanks(["2026-06-25:1", "2026-06-26:3", "bad", "2026-06-27:9"]);
    expect(m.get("2026-06-25")).toBe("1");
    expect(m.get("2026-06-26")).toBe("3");
    expect(m.has("bad")).toBe(false);
    expect(m.has("2026-06-27")).toBe(false); // rank 9 invalid
  });
  it("handles undefined as empty", () => {
    expect(parseRanks(undefined).size).toBe(0);
  });
  it("encodes back sorted by key for stable output", () => {
    const m = new Map<string, "1" | "2" | "3">([
      ["2026-06-26", "3"],
      ["2026-06-25", "1"],
    ]);
    expect(encodeRanks(m)).toEqual(["2026-06-25:1", "2026-06-26:3"]);
  });
});

describe("rankOn", () => {
  it("returns the rank for a key or null", () => {
    expect(rankOn(["2026-06:2"], "2026-06")).toBe("2");
    expect(rankOn(["2026-06:2"], "2026-07")).toBeNull();
    expect(rankOn(undefined, "2026-06")).toBeNull();
  });
});

describe("writeRank", () => {
  it("sets a rank, folding the legacy value in on first write", () => {
    const out = writeRank(undefined, "2026-06-26", "2", {
      value: "1",
      key: "2026-06-25",
    });
    expect(out).toEqual(["2026-06-25:1", "2026-06-26:2"]);
  });
  it("does not re-fold legacy once the array is non-empty", () => {
    const out = writeRank(["2026-06-25:1"], "2026-06-26", "2", {
      value: "3",
      key: "2026-06-20",
    });
    expect(out).toEqual(["2026-06-25:1", "2026-06-26:2"]);
  });
  it("clears a rank when rank is null", () => {
    expect(writeRank(["2026-06-25:1", "2026-06-26:2"], "2026-06-25", null, { key: null })).toEqual([
      "2026-06-26:2",
    ]);
  });
});
