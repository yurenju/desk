import { useEffect } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useTasksStore } from "@/store/tasks";
import { TodayLayout } from "@/features/plan-view/TodayLayout";
import { currentMonthISO } from "@/lib/date";
import { Button } from "@/ui/Button/Button";

// ─── Skeleton ────────────────────────────────────────────────────────────────

function TodaySkeleton() {
  return (
    <main aria-busy="true" style={{ padding: "1.5rem" }}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            height: "2.5rem",
            borderRadius: "0.5rem",
            background: "var(--color-paper-alt)",
            marginBottom: "0.75rem",
          }}
        />
      ))}
    </main>
  );
}

// ─── TodayView (exported for tests) ──────────────────────────────────────────

export function TodayView({ date }: { date: string }) {
  const status = useTasksStore((s) => s.status);
  const tasks = useTasksStore((s) => s.tasks);
  const today = useTasksStore((s) => s.today);

  useEffect(() => {
    useTasksStore.getState().loadTasks();
  }, []);

  if (status === "loading" || status === "idle") return <TodaySkeleton />;

  if (status === "error") {
    return (
      <div role="alert" style={{ padding: "1.5rem" }}>
        載入失敗
        <Button variant="ghost" size="sm" onClick={() => useTasksStore.getState().reload()}>重試</Button>
      </div>
    );
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

// `/today` is a layout for both the bare `/today` (index) and `/today/$date`
// child routes. It must render <Outlet/> so the matched child renders; the
// concrete views live in today.index.tsx and today.$date.tsx.
function TodayLayoutRoute() {
  return <Outlet />;
}

export const Route = createFileRoute("/today")({
  component: TodayLayoutRoute,
});
