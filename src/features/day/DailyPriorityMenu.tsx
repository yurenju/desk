import type { Priority } from "@/lib/types";
import { Menu } from "@/ui/Menu";
import { PriorityRing } from "@/ui/PriorityRing";

/**
 * Shared "今日重點" priority picker used by both TaskRow and the top-3 card.
 * Renders the priority ring as the trigger and the 1/2/3/clear menu.
 */
export function DailyPriorityMenu({
  value,
  onSelect,
}: {
  value: Priority | null;
  onSelect: (priority: Priority | null) => void;
}) {
  return (
    <Menu
      ariaLabel="今日重點"
      selectedKey={value ?? "none"}
      trigger={<PriorityRing value={value} />}
      items={[
        { key: "1", label: "① 今日第一", onSelect: () => onSelect("1") },
        { key: "2", label: "② 今日第二", onSelect: () => onSelect("2") },
        { key: "3", label: "③ 今日第三", onSelect: () => onSelect("3") },
        { key: "none", label: "— 移除重點", onSelect: () => onSelect(null) },
      ]}
    />
  );
}
