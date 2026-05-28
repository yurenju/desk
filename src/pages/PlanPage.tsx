import { PlanLayout } from "@/features/plan-view/PlanLayout";
import { allTasks, MOCK_TODAY, MOCK_THIS_MONTH } from "@/mock/data";

export function PlanPage() {
  return <PlanLayout allTasks={allTasks} selectedDate={MOCK_TODAY} month={MOCK_THIS_MONTH} />;
}
