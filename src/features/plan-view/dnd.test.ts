import { describe, it, expect } from "vitest";
import { dropId, parseDropId } from "./dnd";

describe("dropId / parseDropId", () => {
  it("round-trips the month target", () => {
    expect(parseDropId(dropId({ kind: "month" }))).toEqual({ kind: "month" });
  });

  it("round-trips a day target with zone", () => {
    const id = dropId({ kind: "day", date: "2026-06-08", zone: "top3" });
    expect(parseDropId(id)).toEqual({ kind: "day", date: "2026-06-08", zone: "top3" });
  });

  it("round-trips a weekday target", () => {
    const id = dropId({ kind: "weekday", date: "2026-06-08" });
    expect(parseDropId(id)).toEqual({ kind: "weekday", date: "2026-06-08" });
  });

  it("returns null for an unknown id", () => {
    expect(parseDropId("nonsense")).toBeNull();
  });
});
