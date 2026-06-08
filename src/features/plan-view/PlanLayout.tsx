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

  // The same task can render as a draggable in several columns at once (e.g. a
  // focus-day task shows in the Day column, the Month "other" list, AND the Week
  // cell). dnd-kit requires unique draggable ids, so each surface namespaces its
  // id: "month:<taskId>", "day:<taskId>", "week:<date>:<taskId>". Recover the
  // real task id by stripping the namespace prefix.
  // Task ids are uuid / "temp-<uuid>" style; even if one ever held a colon the
  // slicing below keeps every segment after the prefix.
  function resolveTaskId(activeId: string): string {
    if (activeId.startsWith("week:")) {
      // week:<YYYY-MM-DD>:<taskId> — drop the first two segments.
      const afterDate = activeId.indexOf(":", "week:".length);
      return activeId.slice(afterDate + 1);
    }
    if (activeId.startsWith("month:")) return activeId.slice("month:".length);
    if (activeId.startsWith("day:")) return activeId.slice("day:".length);
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
    // Resolve the destination day + zone. Day-column drops carry their zone in
    // the drop id; week cells are a single droppable, so derive top-3 vs other
    // from where in the cell the pointer released (upper half = top-3).
    const date = target.date;
    let zone: "top3" | "other";
    if (target.kind === "weekday") {
      const rect = e.over.rect;
      // Final pointer Y = where the drag activated + total movement. Guard the
      // sensor type instead of casting: a non-pointer activator (only possible
      // if a keyboard/touch sensor is added later) leaves pointerY as Infinity,
      // which safely defaults the drop to "other" rather than computing NaN.
      const activator = e.activatorEvent;
      const pointerY =
        activator instanceof PointerEvent ? activator.clientY + e.delta.y : Infinity;
      zone = pointerY < rect.top + rect.height / 2 ? "top3" : "other";
    } else {
      zone = target.zone;
    }
    void (async () => {
      await store.planScheduleDay(id, date);
      const s = useTasksStore.getState();
      const task = s.tasks.find((t) => t.id === id);
      // Only set priority if the schedule actually landed (guards the rollback-on-failure case)
      const dates = task?.custom_fields.scheduled_dates ?? [];
      if (dates[dates.length - 1] !== date) return;
      if (zone === "top3") {
        void s.setDailyPriority(id, nextFreeDailySlot(s.tasks, date, id), date);
      } else {
        void s.setDailyPriority(id, null, date);
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
