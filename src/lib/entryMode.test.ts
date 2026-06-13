import { describe, it, expect, beforeEach } from "vitest";
import {
  getEntryMode,
  setEntryMode,
  isAdhocOf,
  STORAGE_KEY,
  __subscribe as subscribeForTest,
} from "./entryMode";

beforeEach(() => {
  localStorage.clear();
  setEntryMode("planned"); // reset module-level state between tests
});

describe("entryMode", () => {
  it("defaults to planned", () => {
    expect(getEntryMode()).toBe("planned");
  });

  it("setEntryMode updates the value and persists to localStorage", () => {
    setEntryMode("adhoc");
    expect(getEntryMode()).toBe("adhoc");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("adhoc");
  });

  it("isAdhocOf maps modes to a boolean", () => {
    expect(isAdhocOf("adhoc")).toBe(true);
    expect(isAdhocOf("planned")).toBe(false);
  });

  it("notifies subscribers on change", () => {
    let calls = 0;
    const unsub = subscribeForTest(() => {
      calls += 1;
    });
    setEntryMode("adhoc");
    expect(calls).toBe(1);
    unsub();
  });
});
