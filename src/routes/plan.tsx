import { useEffect } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useTasksStore } from "@/store/tasks";
import { PlanLayout } from "@/features/plan-view/PlanLayout";
import { LoadSkeleton, LoadError } from "@/features/plan-view/LoadStates";
import { currentMonthISO } from "@/lib/date";

export function PlanView({ date }: { date: string }) {
  const status = useTasksStore((s) => s.status);
  const tasks = useTasksStore((s) => s.tasks);

  useEffect(() => {
    useTasksStore.getState().loadTasks();
  }, []);

  if (status === "loading" || status === "idle") return <LoadSkeleton />;
  if (status === "error") {
    return <LoadError onRetry={() => useTasksStore.getState().reload()} />;
  }
  const month = currentMonthISO(new Date(date + "T00:00:00"));
  return <PlanLayout allTasks={tasks} selectedDate={date} month={month} />;
}

function PlanLayoutRoute() {
  return <Outlet />;
}

export const Route = createFileRoute("/plan")({
  component: PlanLayoutRoute,
});
