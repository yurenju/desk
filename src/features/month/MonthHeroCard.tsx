import type { Task } from "@/lib/types";
import { Top3Card } from "@/features/day/Top3Card";

export interface MonthHeroCardProps {
  top3: Task[];
}

export function MonthHeroCard({ top3 }: MonthHeroCardProps) {
  return <Top3Card tasks={top3} title="本月最重要的三件事" variant="plain" />;
}
