import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type Over,
} from "@dnd-kit/core";
import type { Task } from "@/lib/types";
import { MonthColumn } from "@/features/month/MonthColumn";
import { WeekColumn } from "@/features/week/WeekColumn";
import { DayColumn } from "@/features/day/DayColumn";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { useTasksStore } from "@/store/tasks";
import { nextFreeDailySlot } from "@/lib/tasks";
import { useHoverCapable } from "@/lib/useHoverCapable";
import { DragEnabledProvider, WeekDropHintProvider, type WeekDropHint } from "./dragContext";
import { parseDropId } from "./dnd";
import styles from "./PlanLayout.module.css";

const ACTIVATION = { distance: 8 };

// pointerWithin keeps the over-cell exactly under the cursor (rectIntersection
// would pick a neighbour via the drag ghost's larger rect, making the week hint
// jump). But pointerWithin returns nothing when the pointer is in a gap between
// droppables (e.g. the space between the Day column's top-3 and other zones),
// which would silently drop the task; fall back to rectIntersection there.
const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : rectIntersection(args);
};

/**
 * Top-3 (upper half) vs other (lower half) of a week cell, from the live pointer
 * Y. Both `pointerY` (viewport clientY) and `over.rect` are viewport-relative and
 * re-measured during the drag, so this stays correct even while the page
 * auto-scrolls — unlike `activatorEvent.clientY + delta`, where the fixed
 * activator coordinate diverges from the scrolled content.
 */
function weekCellZone(over: Over, pointerY: number): "top3" | "other" {
  return pointerY < over.rect.top + over.rect.height / 2 ? "top3" : "other";
}

export interface PlanLayoutProps {
  allTasks: Task[];
  selectedDate: string;
  month: string;
}

type MobileTab = "month" | "week" | "day";

export function PlanLayout({ allTasks, selectedDate, month }: PlanLayoutProps) {
  const [tab, setTab] = useState<MobileTab>("month");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [weekHint, setWeekHint] = useState<WeekDropHint | null>(null);
  const dragEnabled = useHoverCapable();

  // dnd-kit events don't carry the live pointer position, and deriving it from
  // activator + delta breaks under auto-scroll, so track it from the window.
  const pointerY = useRef(0);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerY.current = e.clientY;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
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

  // Live "which half am I over" hint for week cells. Only updates state when the
  // (date, zone) actually changes, so React bails out of re-renders while the
  // pointer moves within the same half.
  function handleDragMove(e: DragMoveEvent) {
    const over = e.over;
    const target = over ? parseDropId(String(over.id)) : null;
    if (!over || target?.kind !== "weekday") {
      setWeekHint(null); // React bails out of the re-render when already null
      return;
    }
    const zone = weekCellZone(over, pointerY.current);
    setWeekHint((prev) =>
      prev && prev.date === target.date && prev.zone === zone ? prev : { date: target.date, zone },
    );
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    setWeekHint(null);
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
    const zone = target.kind === "weekday" ? weekCellZone(e.over, pointerY.current) : target.zone;
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
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setWeekHint(null);
      }}
    >
      <DragEnabledProvider value={dragEnabled}>
        <WeekDropHintProvider value={weekHint}>
        <main className={styles.page}>
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
        </WeekDropHintProvider>
      </DragEnabledProvider>
    </DndContext>
  );
}
