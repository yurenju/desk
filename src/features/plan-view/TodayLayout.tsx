import { useRef, useState } from "react";
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
import { WeekRail } from "@/features/week/WeekRail";
import { DayColumn } from "@/features/day/DayColumn";
import { MonthDigest } from "@/features/month/MonthDigest";
import { DayChip } from "@/features/week/DayChip";
import { weekOf, addDays } from "@/lib/date";
import { DeleteUndoToast } from "@/features/day/DeleteUndoToast";
import { useHoverCapable } from "@/lib/useHoverCapable";
import { DragEnabledProvider } from "./dragContext";
import { DragOrderingProvider } from "./useDragOrdering";
import {
  buildDayContainers,
  commitFinalOrder,
  commitPlan,
  isSortableHit,
  makeCollisionDetection,
  planCommit,
  resolveOver,
  rowTaskId,
  type ContainerMap,
} from "./planDrag";
import styles from "./TodayLayout.module.css";

const ACTIVATION = { distance: 8 };

export interface TodayLayoutProps {
  allTasks: Task[];
  selectedDate: string;
  today: string;
  month: string;
}

export function TodayLayout({ allTasks, selectedDate, today, month }: TodayLayoutProps) {
  // The week the rail/chips display, decoupled from the focus day: paging the
  // arrows moves only this anchor, leaving the center hero on `selectedDate`.
  // It snaps back to the focus day's week whenever the focus day changes —
  // done via the "adjust state during render on prop change" pattern (comparing
  // against the previous focus day) rather than an effect, which would cascade.
  const [weekAnchor, setWeekAnchor] = useState(selectedDate);
  const [prevSelectedDate, setPrevSelectedDate] = useState(selectedDate);
  if (selectedDate !== prevSelectedDate) {
    setPrevSelectedDate(selectedDate);
    setWeekAnchor(selectedDate);
  }
  const week = weekOf(weekAnchor);

  const [activeId, setActiveId] = useState<string | null>(null);
  // Live in-column sortable preview: containerId -> previewed sortable-id order.
  const [preview, setPreview] = useState<ContainerMap>(() => new Map());
  // The sortable id (e.g. "day:<taskId>") and source container of the active row
  // while an in-column drag is in flight. null when nothing in-column is dragging.
  const dragSource = useRef<{ sortableId: string; container: string } | null>(null);
  const dragEnabled = useHoverCapable();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: ACTIVATION }));

  const activeTask = activeId ? allTasks.find((t) => t.id === activeId) : null;

  // Base (pre-preview) sortable order. Focus only renders the center Day column,
  // so the container map covers ONLY the focus day's top3/other/adhoc sections.
  // There are no month/week/backlog drop columns here, so no Slice-4 zones.
  const baseContainers: ContainerMap = buildDayContainers(allTasks, selectedDate);

  // The set of sortable row ids currently registered (members of any container).
  const sortableMembers = new Set<string>();
  for (const ids of baseContainers.values()) for (const id of ids) sortableMembers.add(id);
  const collisionDetection = makeCollisionDetection(sortableMembers);

  // previewOrder hands each SortableContext the order to render: its preview
  // override if a drag is rearranging it, otherwise the base ids it passed in.
  const previewOrder = (containerId: string, baseIds: string[]): string[] => {
    return preview.get(containerId) ?? baseIds;
  };

  function handleDragStart(e: DragStartEvent) {
    const rawId = String(e.active.id);
    setActiveId(rowTaskId(rawId));
    dragSource.current = null;
    for (const [cid, ids] of baseContainers) {
      if (ids.includes(rawId)) {
        dragSource.current = { sortableId: rawId, container: cid };
        break;
      }
    }
  }

  // No live cross-container reflow preview.
  //
  // dnd-kit measures the active (dragged) row and its parent via `useRect`, which
  // remeasures on every `document.body` childList mutation and setStates whenever
  // the rect changes (core.cjs `useRect` → `containerNodeRect = useRect(activeNode
  // .parentElement)`, ungated). A preview that physically moves the active row
  // between sections mutates childList → remeasure → dnd-kit re-fires onDragOver on
  // the new rect → setPreview → reflow → … until React throws #185 ("Maximum update
  // depth exceeded") and the whole <DndContext> is torn down by the error boundary.
  // Same-container reorders already avoided this by setting no preview (native
  // SortableContext transforms shift rows visually without mutating childList);
  // cross-container now does too. Feedback is the floating DragOverlay + the
  // drop-zone highlight, and the drop still lands correctly because commitFinalOrder
  // reconstructs the order from resolveOver(over) at release (base + insert index).
  // ponytail: drop the live shuffle to kill the loop; revisit only if the
  // cross-section insertion animation is worth a placeholder-based reimplementation.
  function handleDragOver() {
    setPreview((prev) => (prev.size ? new Map() : prev));
  }

  function handleDragEnd(e: DragEndEvent) {
    const src = dragSource.current;
    dragSource.current = null;
    setActiveId(null);

    // In-column sortable drop: commit via the shared planner, then clear preview.
    // Focus has no Slice-4 cross-column zones, so this is the only drop path.
    // Accept both a container droppable and a sortable member row as the over id.
    if (src && e.over && isSortableHit(String(e.over.id), sortableMembers)) {
      const resolved = resolveOver(String(e.over.id), baseContainers);
      const droppedTask = allTasks.find((t) => t.id === rowTaskId(src.sortableId));
      if (resolved && droppedTask) {
        // Same-container: arrayMove(base, oldIndex, newIndex) (no preview exists).
        // Cross-container: the live preview order (active already inserted).
        const finalOrder = commitFinalOrder(baseContainers, preview, src, resolved);
        const plan = planCommit({
          over: resolved,
          finalOrder,
          activeId: src.sortableId,
          activeTask: droppedTask,
        });
        void commitPlan(plan);
      }
    }
    setPreview(new Map());
  }

  return (
    <main className={styles.page}>
      <div className={styles.grid}>
        <aside className={[styles.cell, styles.left].join(" ")}>
          <WeekRail
            allTasks={allTasks}
            weekAnchor={weekAnchor}
            selectedDate={selectedDate}
            today={today}
            onPrevWeek={() => setWeekAnchor((a) => addDays(a, -7))}
            onNextWeek={() => setWeekAnchor((a) => addDays(a, 7))}
            onResetToToday={() => setWeekAnchor(today)}
          />
        </aside>
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            dragSource.current = null;
            setActiveId(null);
            setPreview(new Map());
          }}
        >
          <DragEnabledProvider value={dragEnabled}>
            <DragOrderingProvider value={{ activeId, previewOrder }}>
              <section className={[styles.cell, styles.center].join(" ")}>
                <DayColumn allTasks={allTasks} selectedDate={selectedDate} variant="today-hero" />
              </section>
              <DragOverlay>
                {activeTask ? <div className={styles.dragGhost}>{activeTask.title}</div> : null}
              </DragOverlay>
            </DragOrderingProvider>
          </DragEnabledProvider>
        </DndContext>
        <aside className={[styles.cell, styles.right].join(" ")}>
          <MonthDigest allTasks={allTasks} month={month} today={today} selectedDate={selectedDate} />
        </aside>
      </div>

      <nav className={styles.mobileChips} aria-label="日期切換">
        <button
          type="button"
          onClick={() => setWeekAnchor((a) => addDays(a, -7))}
          className={styles.chipStep}
          aria-label="上一週"
        >
          ‹
        </button>
        {week.map((date) => (
          <DayChip
            key={date}
            date={date}
            today={today}
            selected={date === selectedDate}
            allTasks={allTasks}
          />
        ))}
        <button
          type="button"
          onClick={() => setWeekAnchor((a) => addDays(a, 7))}
          className={styles.chipStep}
          aria-label="下一週"
        >
          ›
        </button>
      </nav>

      <DeleteUndoToast />
    </main>
  );
}
