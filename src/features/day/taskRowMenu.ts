import type { Task } from "@/lib/types";
import type { MenuItemSpec } from "@/ui/Menu/Menu";
import type { useTaskRow } from "./useTaskRow";

/**
 * Shared overflow-menu items for a day task row.
 *
 * Both TaskRow (carryover / other-planned rows) and Top3Item (the "最重要的三件事"
 * card) render the same set of row actions. Defining them here keeps the two
 * call sites from drifting out of sync — historically a new action was added to
 * one and forgotten on the other.
 *
 * "移到今天" only appears when looking at a past day (date !== today).
 */
export function buildTaskRowMenuItems({
  task,
  date,
  today,
  row,
}: {
  task: Task;
  date: string;
  today: string;
  row: ReturnType<typeof useTaskRow>;
}): MenuItemSpec[] {
  const isAdhoc = task.custom_fields.is_adhoc === "true";
  return [
    ...(date !== today
      ? [{ key: "move-today", label: "⤴ 移到今天", onSelect: row.moveToToday } satisfies MenuItemSpec]
      : []),
    { key: "demote-month", label: "↩ 丟回月度", onSelect: row.demoteToMonth },
    isAdhoc
      ? { key: "to-planned", label: "↑ 移到計畫內", onSelect: row.toggleAdhoc }
      : { key: "to-adhoc", label: "↓ 標為計畫外", onSelect: row.toggleAdhoc },
    { key: "edit", label: "編輯", onSelect: () => row.startEdit(task.title) },
    { key: "delete", label: "刪除", onSelect: row.remove, danger: true },
  ];
}
