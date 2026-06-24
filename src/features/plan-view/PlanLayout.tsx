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
  type DragOverEvent,
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
import { DragOrderingProvider } from "./useDragOrdering";
import { parseDropId } from "./dnd";
import {
  buildDayContainers,
  buildMonthContainers,
  buildWeekContainers,
  computePreview,
  isSortableContainerId,
  planCommit,
  resolveOver,
  rowTaskId,
  type ContainerMap,
} from "./planDrag";
import { weekOf } from "@/lib/date";
import styles from "./PlanLayout.module.css";

const ACTIVATION = { distance: 8 };

// Whether a dnd-kit hit id is one of our sortable surfaces: a container droppable
// (top3/other/adhoc/mtop3/poolMonth/...) or a sortable row member ("day:"/"month:").
function isSortableHit(id: string, members: Set<string>): boolean {
  return isSortableContainerId(id) || members.has(id);
}

// pointerWithin keeps the over-cell exactly under the cursor (rectIntersection
// would pick a neighbour via the drag ghost's larger rect, making the week hint
// jump). But pointerWithin returns nothing when the pointer is in a gap between
// droppables (e.g. the space between the Day column's top-3 and other zones),
// which would silently drop the task; fall back to rectIntersection there.
//
// `sortableMembers` is the set of sortable row ids currently registered in the
// base container map. A row id (e.g. "month:<id>") is a sortable surface ONLY
// when it's a member — a Slice-4 month/week row that isn't in any container must
// fall through to the coarse drop:* zones.
function makeCollisionDetection(sortableMembers: Set<string>): CollisionDetection {
  return (args) => {
    const within = pointerWithin(args);
    const hits = within.length > 0 ? within : rectIntersection(args);
    // A sortable row is both a sortable (container + item ids) AND sits inside the
    // Slice-4 free-form drop zones (drop:day:<date>:* / drop:month). When an
    // in-column sortable row is the active drag, prefer the sortable hits so the
    // live reorder/overflow preview drives, not the coarse zone. The zones still
    // win for Slice-4 cross-column drags (backlog/trail rows), whose active id
    // isn't a sortable container member.
    const activeIsSortableRow = sortableMembers.has(String(args.active.id));
    if (activeIsSortableRow) {
      const sortableHits = hits.filter((h) => isSortableHit(String(h.id), sortableMembers));
      if (sortableHits.length > 0) return sortableHits;
      return hits;
    }
    // Slice-4 cross-column drag (backlog / trail row): the sortable container +
    // item droppables must NOT intercept — the coarse free-form drop:* zones own
    // these drops. Drop the sortable hits so the zone wins.
    const zoneHits = hits.filter((h) => !isSortableHit(String(h.id), sortableMembers));
    return zoneHits.length > 0 ? zoneHits : hits;
  };
}

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
  // Live in-column sortable preview: containerId -> previewed sortable-id order.
  const [preview, setPreview] = useState<ContainerMap>(() => new Map());
  // The sortable id (e.g. "day:<taskId>") and source container of the active row
  // while an in-column drag is in flight. null when the active drag is a Slice-4
  // cross-column drag (a free draggable, not part of any SortableContext).
  const dragSource = useRef<{ sortableId: string; container: string } | null>(null);
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

  // Base (pre-preview) sortable order for the Day + Month + Week columns the Plan
  // view renders. Rebuilt on every render from the live task list, so it always
  // reflects the committed state the columns derive from.
  const weekDates = weekOf(selectedDate);
  const baseContainers: ContainerMap = new Map([
    ...buildDayContainers(allTasks, selectedDate),
    ...buildMonthContainers(allTasks, month, selectedDate),
    ...buildWeekContainers(allTasks, weekDates),
  ]);

  // The set of sortable row ids currently registered (members of any container).
  // collisionDetection uses it to tell an in-column sortable row from a Slice-4
  // free draggable that happens to share the "month:"/"day:" namespace.
  const sortableMembers = new Set<string>();
  for (const ids of baseContainers.values()) for (const id of ids) sortableMembers.add(id);
  const collisionDetection = makeCollisionDetection(sortableMembers);

  // previewOrder hands each SortableContext the order to render: its preview
  // override if a drag is rearranging it, otherwise the base ids it passed in.
  const previewOrder = (containerId: string, baseIds: string[]): string[] => {
    return preview.get(containerId) ?? baseIds;
  };

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
    // If this row belongs to one of the Day column's sortable containers, record
    // its source so onDragOver can build live previews. Day rows are namespaced
    // "day:<taskId>"; everything else is a Slice-4 free draggable.
    dragSource.current = null;
    for (const [cid, ids] of baseContainers) {
      if (ids.includes(rawId)) {
        dragSource.current = { sortableId: rawId, container: cid };
        break;
      }
    }
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

  // Live overflow / reorder preview for the Day column's sortable sections.
  // Runs only for in-column sortable drags (dragSource set) hovering over a
  // sortable container; otherwise clears any stale preview so the column snaps
  // back (e.g. when the pointer leaves the sortable area onto a week cell).
  function handleDragOver(e: DragOverEvent) {
    const src = dragSource.current;
    if (!src) return;
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || !isSortableContainerId(overId)) {
      setPreview((prev) => (prev.size ? new Map() : prev));
      return;
    }
    const resolved = resolveOver(overId, baseContainers);
    if (!resolved) return;
    const next = computePreview(
      baseContainers,
      src.sortableId,
      src.container,
      resolved.container,
      resolved.index,
    );
    setPreview(next);
  }

  // Insert `activeId` into `order` at `index` (used when the drop lands on a
  // container the preview never touched — e.g. dropping straight back).
  function insertActive(order: string[], activeId: string, index: number): string[] {
    const without = order.filter((id) => id !== activeId);
    without.splice(Math.min(index, without.length), 0, activeId);
    return without;
  }

  // Map a CommitPlan to store mutations. Reused by Tasks 9-12 via the same plan.
  async function commitPlan(plan: ReturnType<typeof planCommit>) {
    const store = useTasksStore.getState();
    if (plan.kind === "rank") {
      await store.reorderPriority(plan.taskId, String(plan.rank) as "1" | "2" | "3", plan.axis, plan.scope);
      return;
    }
    if (plan.kind === "pool") {
      // Cross-column source (daily axis only): ensure the task is scheduled on
      // this day first. Month-pool reorder never schedules a day.
      if (plan.crossColumn && plan.axis === "daily") {
        await store.planScheduleDay(plan.taskId, plan.scope);
        const s = useTasksStore.getState();
        const dates = s.tasks.find((t) => t.id === plan.taskId)?.custom_fields.scheduled_dates ?? [];
        if (dates[dates.length - 1] !== plan.scope) return; // schedule rolled back
      }
      // Demote out of three-things if it carried a priority on this axis.
      if (plan.hadPriority) {
        if (plan.axis === "monthly") {
          await useTasksStore.getState().setMonthlyPriority(plan.taskId, null, plan.scope);
        } else {
          await useTasksStore.getState().setDailyPriority(plan.taskId, null, plan.scope);
        }
      }
      await useTasksStore.getState().reorderInPool(plan.taskId, plan.prevId, plan.nextId);
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    const src = dragSource.current;
    dragSource.current = null;
    setActiveId(null);
    setWeekHint(null);

    // In-column sortable drop: commit via the shared planner, then clear preview.
    if (src && e.over && isSortableContainerId(String(e.over.id))) {
      const resolved = resolveOver(String(e.over.id), baseContainers);
      const activeTask = allTasks.find((t) => t.id === rowTaskId(src.sortableId));
      if (resolved && activeTask) {
        // Final order of the over-container = current preview (which already has
        // the active row inserted), or base when hovering an unchanged container.
        const finalOrder =
          preview.get(resolved.container) ?? baseContainers.get(resolved.container) ?? [];
        const plan = planCommit({
          over: resolved,
          finalOrder: finalOrder.includes(src.sortableId)
            ? finalOrder
            : insertActive(finalOrder, src.sortableId, resolved.index),
          activeId: src.sortableId,
          activeTask,
        });
        void commitPlan(plan);
      }
      setPreview(new Map());
      return;
    }
    setPreview(new Map());

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
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        dragSource.current = null;
        setActiveId(null);
        setWeekHint(null);
        setPreview(new Map());
      }}
    >
      <DragEnabledProvider value={dragEnabled}>
        <DragOrderingProvider value={{ activeId, previewOrder }}>
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
        </DragOrderingProvider>
      </DragEnabledProvider>
    </DndContext>
  );
}
