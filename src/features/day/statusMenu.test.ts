import { describe, it, expect, vi } from "vitest";
import { buildStatusMenuItems, type StatusMenuActions } from "./statusMenu";

function fakeActions(): StatusMenuActions {
  return {
    toggle: vi.fn(),
    restoreToDay: vi.fn(),
    demoteToMonth: vi.fn(),
    moveToToday: vi.fn(),
  };
}

describe("buildStatusMenuItems", () => {
  it("forwarded: offers done/restore/demote-to-month, excludes move-to-today", () => {
    const row = fakeActions();
    const items = buildStatusMenuItems({ kind: "forwarded", row });
    const keys = items.map((i) => i.key);
    expect(keys).toContain("done");
    expect(keys).toContain("restore");
    expect(keys).toContain("demote-month");
    expect(keys).not.toContain("move-today");
  });

  it("dismissed: offers done/restore/move-to-today, excludes demote-to-month", () => {
    const row = fakeActions();
    const items = buildStatusMenuItems({ kind: "dismissed", row });
    const keys = items.map((i) => i.key);
    expect(keys).toContain("done");
    expect(keys).toContain("restore");
    expect(keys).toContain("move-today");
    expect(keys).not.toContain("demote-month");
  });

  it("wires each item to the matching row action", () => {
    const row = fakeActions();
    const items = buildStatusMenuItems({ kind: "forwarded", row });
    items.find((i) => i.key === "done")!.onSelect();
    expect(row.toggle).toHaveBeenCalled();
    items.find((i) => i.key === "restore")!.onSelect();
    expect(row.restoreToDay).toHaveBeenCalled();
    items.find((i) => i.key === "demote-month")!.onSelect();
    expect(row.demoteToMonth).toHaveBeenCalled();
  });
});
