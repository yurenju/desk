import { useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Task } from "@/lib/types";
import { WeekRail } from "@/features/week/WeekRail";
import { DayColumn } from "@/features/day/DayColumn";
import { MonthDigest } from "@/features/month/MonthDigest";
import { DayChip } from "@/features/week/DayChip";
import { Link } from "@tanstack/react-router";
import { weekOf, addDays } from "@/lib/date";
import { DeleteUndoToast } from "@/features/day/DeleteUndoToast";
import { useHoverCapable } from "@/lib/useHoverCapable";
import { DragEnabledProvider } from "./dragContext";
import { DragOrderingProvider } from "./useDragOrdering";
import {
  buildDayContainers,
  commitFinalOrder,
  commitPlan,
  dragOverPreview,
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
  const week = weekOf(selectedDate);

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

  // Live overflow / reorder preview for the Day column's sortable sections.
  function handleDragOver(e: DragOverEvent) {
    const src = dragSource.current;
    if (!src) return;
    const overId = e.over ? String(e.over.id) : null;
    // over.id is either a container droppable (top3:DATE) OR a sortable member
    // row (day:<id>) when hovering directly over a sibling. Both are valid
    // sortable hits; isSortableContainerId alone would miss the row case and
    // wrongly clear the preview, dropping the reorder.
    if (!overId || !isSortableHit(overId, sortableMembers)) {
      setPreview((prev) => (prev.size ? new Map() : prev));
      return;
    }
    const resolved = resolveOver(overId, baseContainers);
    if (!resolved) return;
    // Same-container moves return null: clear any stale preview and let
    // SortableContext animate the reorder natively (a preview override here
    // would fight the native transforms → infinite render loop).
    const next = dragOverPreview(baseContainers, src, resolved);
    if (next === null) {
      setPreview((prev) => (prev.size ? new Map() : prev));
      return;
    }
    setPreview(next);
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
          <WeekRail allTasks={allTasks} selectedDate={selectedDate} today={today} />
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
        <Link
          to="/focus/$date"
          params={{ date: addDays(selectedDate, -7) }}
          className={styles.chipStep}
          aria-label="上一週"
        >
          ‹
        </Link>
        {week.map((date) => (
          <DayChip
            key={date}
            date={date}
            today={today}
            selected={date === selectedDate}
            allTasks={allTasks}
          />
        ))}
        <Link
          to="/focus/$date"
          params={{ date: addDays(selectedDate, 7) }}
          className={styles.chipStep}
          aria-label="下一週"
        >
          ›
        </Link>
      </nav>

      <DeleteUndoToast />
    </main>
  );
}
