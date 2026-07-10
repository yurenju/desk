import type { MenuItemSpec } from "@/ui/Menu/Menu";

/** The subset of useTaskRow actions the status menu needs. */
export interface StatusMenuActions {
  toggle: () => void;
  restoreToDay: () => void;
  demoteToMonth: () => void;
  moveToToday: () => void;
}

/**
 * Menu items for a trail row's status cell (forwarded / dismissed only —
 * primary rows toggle directly and never open this menu). The current state is
 * excluded: a forwarded row can't "move to today" again from here, a dismissed
 * row can't be "demoted to month" again.
 */
export function buildStatusMenuItems({
  kind,
  row,
}: {
  kind: "forwarded" | "dismissed";
  row: StatusMenuActions;
}): MenuItemSpec[] {
  return [
    { key: "done", label: "已完成", onSelect: row.toggle },
    { key: "restore", label: "未完成", onSelect: row.restoreToDay },
    kind === "forwarded"
      ? { key: "demote-month", label: "↩ 退回本月", onSelect: row.demoteToMonth }
      : { key: "move-today", label: "⤴ 移到今天", onSelect: row.moveToToday },
  ];
}
