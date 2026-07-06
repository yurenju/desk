import type { Priority } from "@/lib/types";
import { Menu } from "@/ui/Menu";
import { PriorityRing } from "@/ui/PriorityRing";

/**
 * Shared "本月重點" priority picker used by both MonthRow and the hero card.
 * Renders the priority ring as the trigger and the 1/2/3/clear menu.
 * Month-side counterpart of the day-side DailyPriorityMenu.
 */
export function MonthPriorityMenu({
  value,
  onSelect,
}: {
  value: Priority | null;
  onSelect: (priority: Priority | null) => void;
}) {
  return (
    <Menu
      ariaLabel="本月重點"
      selectedKey={value ?? "none"}
      trigger={
        <PriorityRing
          value={value}
          aria-label={value ? `本月重點第 ${value}` : "設為本月重點"}
        />
      }
      items={[
        { key: "1", label: "① 本月第一", onSelect: () => onSelect("1") },
        { key: "2", label: "② 本月第二", onSelect: () => onSelect("2") },
        { key: "3", label: "③ 本月第三", onSelect: () => onSelect("3") },
        { key: "none", label: "— 移除重點", onSelect: () => onSelect(null) },
      ]}
    />
  );
}
