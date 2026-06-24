import { useEffect } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useTasksStore } from "@/store/tasks";
import { TodayLayout } from "@/features/plan-view/TodayLayout";
import { currentMonthISO } from "@/lib/date";
import { LoadSkeleton, LoadError } from "@/features/plan-view/LoadStates";

// ─── TodayView (exported for tests) ──────────────────────────────────────────

export function TodayView({ date }: { date: string }) {
  const status = useTasksStore((s) => s.status);
  const tasks = useTasksStore((s) => s.tasks);
  const today = useTasksStore((s) => s.today);

  useEffect(() => {
    useTasksStore.getState().loadTasks();
  }, []);

  if (status === "loading" || status === "idle") return <LoadSkeleton />;

  if (status === "error") {
    return <LoadError onRetry={() => useTasksStore.getState().reload()} />;
  }

  // status === "ready"
  return (
    <TodayLayout
      allTasks={tasks}
      selectedDate={date}
      today={today}
      month={currentMonthISO(new Date(date + "T00:00:00"))}
    />
  );
}

// ─── Route ───────────────────────────────────────────────────────────────────

// `/focus` is a layout for both the bare `/focus` (index) and `/focus/$date`
// child routes. It must render <Outlet/> so the matched child renders; the
// concrete views live in focus.index.tsx and focus.$date.tsx.
function TodayLayoutRoute() {
  return <Outlet />;
}

export const Route = createFileRoute("/focus")({
  component: TodayLayoutRoute,
});
