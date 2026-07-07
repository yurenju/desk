import type { Priority } from "@/lib/types";
import type { MenuItemSpec } from "@/ui/Menu/Menu";

/**
 * The four "→ N 日 · ①②③ / 其他" overflow-menu items that schedule a task onto
 * the focus day, optionally into a top-3 slot. Shared by the backlog and month
 * row menus so the labels and ordering can't drift apart.
 */
export function buildScheduleToDayItems(
  date: string,
  onSchedule: (priority?: Priority | null) => void,
): MenuItemSpec[] {
  const day = date.slice(8);
  return [
    { key: "to-day-1", label: `→ ${day} 日 · ① 三件事`, onSelect: () => onSchedule("1") },
    { key: "to-day-2", label: `→ ${day} 日 · ② 三件事`, onSelect: () => onSchedule("2") },
    { key: "to-day-3", label: `→ ${day} 日 · ③ 三件事`, onSelect: () => onSchedule("3") },
    { key: "to-day-other", label: `→ ${day} 日 · 其他`, onSelect: () => onSchedule() },
  ];
}
