import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Task } from "@/lib/types";
import { CarryoverBanner } from "@/features/carryover/CarryoverBanner";
import { MonthColumn } from "@/features/month/MonthColumn";
import { WeekColumn } from "@/features/week/WeekColumn";
import { DayColumn } from "@/features/day/DayColumn";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { MOCK_CARRYOVER_MONTH } from "@/mock/data";
import { useTasksStore } from "@/store/tasks";
import { nextFreeDailySlot } from "@/lib/tasks";
import { useHoverCapable } from "@/lib/useHoverCapable";
import { DragEnabledProvider } from "./dragContext";
import { parseDropId } from "./dnd";
import styles from "./PlanLayout.module.css";

const ACTIVATION = { distance: 8 };

export interface PlanLayoutProps {
  allTasks: Task[];
  selectedDate: string;
  month: string;
}

type MobileTab = "month" | "week" | "day";

export function PlanLayout({ allTasks, selectedDate, month }: PlanLayoutProps) {
  const [tab, setTab] = useState<MobileTab>("month");
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragEnabled = useHoverCapable();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: ACTIVATION }));

  const activeTask = activeId ? allTasks.find((t) => t.id === activeId) : null;

  // Recover the real task id from a composite week-cell drag id (`week:<date>:<taskId>`)
  // or return the id as-is for plain task draggables.
  // Format: "week:<YYYY-MM-DD>:<taskId>" — parts[0]="week", parts[1]="YYYY-MM-DD", parts[2+]="taskId"
  // Task ids are uuid / "temp-<uuid>" style and contain no colons, so parts.slice(2) is always 1 element.
  function resolveTaskId(activeId: string): string {
    if (activeId.startsWith("week:")) {
      const parts = activeId.split(":");
      // parts[0] = "week", parts[1] = "YYYY-MM-DD", parts[2...] = taskId segments
      return parts.slice(2).join(":");
    }
    return activeId;
  }

  function handleDragStart(e: DragStartEvent) {
    const rawId = String(e.active.id);
    // For week-sourced drags, track the real task id so the overlay shows the title.
    setActiveId(resolveTaskId(rawId));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const target = parseDropId(String(e.over.id));
    if (!target) return;
    const id = resolveTaskId(String(e.active.id));
    const store = useTasksStore.getState();
    if (target.kind === "month") {
      void store.promoteToMonth(id, month);
      return;
    }
    void (async () => {
      await store.planScheduleDay(id, target.date);
      const s = useTasksStore.getState();
      const task = s.tasks.find((t) => t.id === id);
      // Only set priority if the schedule actually landed (guards the rollback-on-failure case)
      const dates = task?.custom_fields.scheduled_dates ?? [];
      if (dates[dates.length - 1] !== target.date) return;
      if (target.zone === "top3") {
        void s.setDailyPriority(id, nextFreeDailySlot(s.tasks, target.date), target.date);
      } else {
        void s.setDailyPriority(id, null, target.date);
      }
    })();
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <DragEnabledProvider value={dragEnabled}>
        <main className={styles.page}>
          <CarryoverBanner
            fromLabel="從上月延續"
            summary={`${MOCK_CARRYOVER_MONTH.fromMonth} 沒做完的任務`}
            count={MOCK_CARRYOVER_MONTH.count}
            actions={["→ 本月三件事", "→ 本月其他", "丟回 backlog"]}
          />

          <div className={styles.mobileTabs}>
            <SegmentedControl<MobileTab>
              value={tab}
              onValueChange={setTab}
              size="sm"
              options={[
                { value: "month", label: "Month" },
                { value: "week", label: "Week" },
                { value: "day", label: "Day" },
              ]}
            />
          </div>

          <div className={styles.grid}>
            <div
              className={[styles.cell, tab !== "month" && styles.mobileHidden]
                .filter(Boolean)
                .join(" ")}
            >
              <MonthColumn allTasks={allTasks} month={month} selectedDate={selectedDate} />
            </div>
            <div
              className={[styles.cell, tab !== "week" && styles.mobileHidden]
                .filter(Boolean)
                .join(" ")}
            >
              <WeekColumn allTasks={allTasks} selectedDate={selectedDate} />
            </div>
            <div
              className={[styles.cell, tab !== "day" && styles.mobileHidden]
                .filter(Boolean)
                .join(" ")}
            >
              <DayColumn allTasks={allTasks} selectedDate={selectedDate} variant="plan-narrow" interactive />
            </div>
          </div>
        </main>
        <DragOverlay>
          {activeTask ? <div className={styles.dragGhost}>{activeTask.title}</div> : null}
        </DragOverlay>
      </DragEnabledProvider>
    </DndContext>
  );
}
