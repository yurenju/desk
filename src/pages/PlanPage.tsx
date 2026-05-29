import { PlanLayout } from "@/features/plan-view/PlanLayout";
import { useTasksStore } from "@/store/tasks";
import { currentMonthISO } from "@/lib/date";

export function PlanPage() {
  const tasks = useTasksStore((s) => s.tasks);
  const today = useTasksStore((s) => s.today);
  return (
    <PlanLayout
      allTasks={tasks}
      selectedDate={today}
      month={currentMonthISO(new Date(today + "T00:00:00"))}
    />
  );
}
