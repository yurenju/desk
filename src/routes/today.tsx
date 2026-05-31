import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTasksStore } from "@/store/tasks";
import { TodayLayout } from "@/features/plan-view/TodayLayout";
import { currentMonthISO, todayISO } from "@/lib/date";

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
            background: "var(--color-surface-raised, #e5e7eb)",
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
    useTasksStore.getState().loadTasks(date);
  }, [date]);

  if (status === "loading") return <TodaySkeleton />;

  if (status === "error") {
    return (
      <div role="alert" style={{ padding: "1.5rem" }}>
        載入失敗
        <button onClick={() => useTasksStore.getState().loadTasks(date)}>重試</button>
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

function TodayRoute() {
  const date = todayISO();
  return <TodayView date={date} />;
}

export const Route = createFileRoute("/today")({
  component: TodayRoute,
});
