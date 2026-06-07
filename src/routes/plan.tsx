import { useEffect } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useTasksStore } from "@/store/tasks";
import { PlanLayout } from "@/features/plan-view/PlanLayout";
import { Button } from "@/ui/Button/Button";
import { currentMonthISO } from "@/lib/date";

function PlanSkeleton() {
  return (
    <main aria-busy="true" style={{ padding: "1.5rem" }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ height: "2.5rem", borderRadius: "0.5rem",
          background: "var(--color-paper-alt)", marginBottom: "0.75rem" }} />
      ))}
    </main>
  );
}

export function PlanView({ date }: { date: string }) {
  const status = useTasksStore((s) => s.status);
  const tasks = useTasksStore((s) => s.tasks);

  useEffect(() => {
    useTasksStore.getState().loadTasks();
  }, []);

  if (status === "loading" || status === "idle") return <PlanSkeleton />;
  if (status === "error") {
    return (
      <div role="alert" style={{ padding: "1.5rem" }}>
        載入失敗
        <Button variant="ghost" size="sm" onClick={() => useTasksStore.getState().reload()}>重試</Button>
      </div>
    );
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
