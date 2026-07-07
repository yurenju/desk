import type { Task } from "@/lib/types";
import type { MenuItemSpec } from "@/ui/Menu/Menu";
import { buildScheduleToDayItems } from "@/features/plan-view/scheduleMenu";
import type { useBacklogRow } from "./useBacklogRow";

/**
 * Overflow-menu items for a backlog row. Kept in its own module to mirror the
 * day-side taskRowMenu and month-side monthRowMenu builders.
 */
export function buildBacklogRowMenuItems({
  task,
  focusDate,
  row,
}: {
  task: Task;
  focusDate: string;
  row: ReturnType<typeof useBacklogRow>;
}): MenuItemSpec[] {
  return [
    { key: "to-month", label: "→ 本月（其他計劃內）", onSelect: row.toMonth },
    ...buildScheduleToDayItems(focusDate, row.toDay),
    { key: "edit", label: "編輯", onSelect: () => row.startEdit(task.title) },
    { key: "delete", label: "刪除", onSelect: row.remove, danger: true },
  ];
}
