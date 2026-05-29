import { TodayLayout } from "@/features/plan-view/TodayLayout";
import { useTasksStore } from "@/store/tasks";
import { currentMonthISO } from "@/lib/date";

export function TodayPage() {
  const tasks = useTasksStore((s) => s.tasks);
  const today = useTasksStore((s) => s.today);
  return (
    <TodayLayout
      allTasks={tasks}
      selectedDate={today}
      today={today}
      month={currentMonthISO(new Date(today + "T00:00:00"))}
    />
  );
}
