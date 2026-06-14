import type { Task } from "@/lib/types";
import type { MenuItemSpec } from "@/ui/Menu/Menu";
import type { useMonthRow } from "./useMonthRow";

/**
 * Shared overflow-menu items for a month task row.
 *
 * Both MonthRow ("其他計劃內 / 計劃外" rows) and MonthHeroItem (本月三件大事 card)
 * render the same actions. Defining them here keeps the two call sites from
 * drifting — historically a new action was added to one and forgotten on the
 * other (same lesson as the day-side taskRowMenu).
 */
export function buildMonthRowMenuItems({
  task,
  selectedDate,
  row,
}: {
  task: Task;
  selectedDate: string;
  row: ReturnType<typeof useMonthRow>;
}): MenuItemSpec[] {
  const isAdhoc = task.custom_fields.is_adhoc === "true";
  const dayLabel = selectedDate.slice(8);
  return [
    { key: "promote-1", label: `→ ${dayLabel} 日 · ① 三件事`, onSelect: () => row.promote("1") },
    { key: "promote-2", label: `→ ${dayLabel} 日 · ② 三件事`, onSelect: () => row.promote("2") },
    { key: "promote-3", label: `→ ${dayLabel} 日 · ③ 三件事`, onSelect: () => row.promote("3") },
    { key: "promote-other", label: `→ ${dayLabel} 日 · 其他`, onSelect: () => row.promote() },
    { key: "move-next-month", label: "↪ 移到下月", onSelect: row.moveToNextMonth },
    { key: "demote-backlog", label: "↩ 丟回 Backlog", onSelect: row.demoteToBacklog },
    isAdhoc
      ? { key: "to-planned", label: "↑ 移到計畫內", onSelect: row.toggleAdhoc }
      : { key: "to-adhoc", label: "↓ 標為計畫外", onSelect: row.toggleAdhoc },
    { key: "edit", label: "編輯", onSelect: () => row.startEdit(task.title) },
    { key: "delete", label: "刪除", onSelect: row.remove, danger: true },
  ];
}
