import { TodayLayout } from "@/features/plan-view/TodayLayout";
import { allTasks, MOCK_TODAY, MOCK_THIS_MONTH } from "@/mock/data";

export function TodayPage() {
  return (
    <TodayLayout
      allTasks={allTasks}
      selectedDate={MOCK_TODAY}
      today={MOCK_TODAY}
      month={MOCK_THIS_MONTH}
    />
  );
}
