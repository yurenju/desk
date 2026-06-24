// Shared drag helpers for in-column sortable reordering (three-things + pools).
//
// Tasks 8-12 all reuse these: container-id parsing, the live overflow-preview
// computation, and the onDragEnd commit planner. PlanLayout / TodayLayout own the
// DndContext + preview state; this module is the pure logic they call into so the
// behaviour stays identical across Day / Month / Week / Focus.

import { arrayMove } from "@dnd-kit/sortable";
import type { Task } from "@/lib/types";
import { tasksOnDate, tasksOnMonth, dayInWeek, byPosition } from "@/lib/tasks";
import { weekOf } from "@/lib/date";

// Sortable item ids reuse the existing day-row namespace: "day:<taskId>".
// Recover the real task id (mirrors PlanLayout.resolveTaskId but scoped to the
// sortable surfaces this module drives).
export function rowTaskId(sortableId: string): string {
  if (sortableId.startsWith("day:")) return sortableId.slice("day:".length);
  if (sortableId.startsWith("month:")) return sortableId.slice("month:".length);
  return sortableId;
}

// Container ids — the namespaces Tasks 9-12 depend on. Each in-column section is
// both a SortableContext AND a droppable carrying one of these ids, so an empty
// section still resolves as an over-target.
export type Container =
  | { kind: "top3"; date: string }
  | { kind: "other"; date: string }
  | { kind: "adhoc"; date: string }
  | { kind: "monthTop3"; month: string }
  | { kind: "poolBacklog" }
  | { kind: "poolMonth"; month: string }
  | { kind: "weekTop3"; date: string };

export function containerId(c: Container): string {
  switch (c.kind) {
    case "top3":
      return `top3:${c.date}`;
    case "other":
      return `other:${c.date}`;
    case "adhoc":
      return `adhoc:${c.date}`;
    case "monthTop3":
      return `mtop3:${c.month}`;
    case "poolBacklog":
      return "pool:backlog";
    case "poolMonth":
      return `pool:month:${c.month}`;
    case "weekTop3":
      return `week:${c.date}:top3`;
  }
}

export function parseContainerId(id: string): Container | null {
  if (id === "pool:backlog") return { kind: "poolBacklog" };
  let m = /^pool:month:(\d{4}-\d{2})$/.exec(id);
  if (m) return { kind: "poolMonth", month: m[1] };
  m = /^mtop3:(\d{4}-\d{2})$/.exec(id);
  if (m) return { kind: "monthTop3", month: m[1] };
  m = /^week:(\d{4}-\d{2}-\d{2}):top3$/.exec(id);
  if (m) return { kind: "weekTop3", date: m[1] };
  m = /^(top3|other|adhoc):(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (m) return { kind: m[1] as "top3" | "other" | "adhoc", date: m[2] };
  return null;
}

// Whether a dnd-kit over-id belongs to one of our sortable surfaces. Used to
// branch away from the Slice-4 cross-column (month/weekday) drop logic.
export function isSortableContainerId(id: string): boolean {
  return parseContainerId(id) !== null;
}

/**
 * Derive the Day column's three sortable containers (top3 / other / adhoc) from
 * the task list, mirroring DayColumn's own derivation so the DndContext's base
 * map matches what the column renders. Ids are namespaced "day:<taskId>".
 */
export function buildDayContainers(allTasks: Task[], date: string): ContainerMap {
  const primary = tasksOnDate(allTasks, date)
    .filter((e) => e.kind === "primary")
    .map((e) => e.task);

  const top3 = primary
    .filter((t) => t.custom_fields.daily_priority)
    .sort(
      (a, b) => Number(a.custom_fields.daily_priority) - Number(b.custom_fields.daily_priority),
    );
  const other = primary
    .filter((t) => !t.custom_fields.daily_priority && t.custom_fields.is_adhoc !== "true")
    .sort(byPosition);
  const adhoc = primary
    .filter((t) => !t.custom_fields.daily_priority && t.custom_fields.is_adhoc === "true")
    .sort(byPosition);

  const map: ContainerMap = new Map();
  map.set(containerId({ kind: "top3", date }), top3.map((t) => `day:${t.id}`));
  map.set(containerId({ kind: "other", date }), other.map((t) => `day:${t.id}`));
  map.set(containerId({ kind: "adhoc", date }), adhoc.map((t) => `day:${t.id}`));
  return map;
}

/**
 * Derive the Month column's two sortable containers (monthTop3 / poolMonth "其他
 * 任務") from the task list, mirroring MonthColumn's own derivation so the
 * DndContext's base map matches what the column renders. Ids are namespaced
 * "month:<taskId>". `selectedDate` fixes the viewed week, which MonthColumn uses
 * to carve "已排入本週" out of the 其他任務 pool.
 */
export function buildMonthContainers(
  allTasks: Task[],
  month: string,
  selectedDate: string,
): ContainerMap {
  const week = weekOf(selectedDate);
  const entries = tasksOnMonth(allTasks, month);

  const top3 = entries
    .filter((e) => e.kind === "primary" && e.task.custom_fields.monthly_priority)
    .sort(
      (a, b) =>
        Number(a.task.custom_fields.monthly_priority) -
        Number(b.task.custom_fields.monthly_priority),
    )
    .map((e) => e.task);

  // 其他任務: outside top3, not scheduled in the viewed week, undone, primary;
  // adhoc sinks below 計劃內, tiebreak byPosition. Mirrors MonthColumn exactly.
  const rest = entries.filter(
    (e) => !(e.kind === "primary" && e.task.custom_fields.monthly_priority),
  );
  const remaining = rest.filter((e) => dayInWeek(e.task, week) === null);
  const undone = remaining.filter((e) => e.task.status !== "done");
  const others = undone
    .filter((e) => e.kind === "primary")
    .sort((a, b) => {
      const adhocDelta =
        Number(a.task.custom_fields.is_adhoc === "true") -
        Number(b.task.custom_fields.is_adhoc === "true");
      return adhocDelta !== 0 ? adhocDelta : byPosition(a.task, b.task);
    })
    .map((e) => e.task);

  const map: ContainerMap = new Map();
  map.set(containerId({ kind: "monthTop3", month }), top3.map((t) => `month:${t.id}`));
  map.set(containerId({ kind: "poolMonth", month }), others.map((t) => `month:${t.id}`));
  return map;
}

// A registry the DndContext owns: containerId -> the ordered sortable ids that
// container currently renders (its *base* order, before any preview). onDragOver
// reads this to compute the over-index and the preview; onDragEnd reads it to
// resolve prev/next neighbours for pool midpoints and the hovered rank.
export type ContainerMap = Map<string, string[]>;

export interface DragOverResult {
  // The preview overrides to apply, keyed by container id. Empty map = no change.
  preview: ContainerMap;
}

/**
 * Resolve which container + index the pointer is over, given the raw dnd-kit
 * `over.id` (either a sortable item id or a container droppable id) and the
 * base container map.
 */
export function resolveOver(
  overId: string,
  base: ContainerMap,
): { container: string; index: number } | null {
  // Direct hit on a container droppable (e.g. an empty section): append.
  if (parseContainerId(overId)) {
    const ids = base.get(overId) ?? [];
    return { container: overId, index: ids.length };
  }
  // Otherwise overId is a sortable row; find which container holds it.
  for (const [cid, ids] of base) {
    const i = ids.indexOf(overId);
    if (i >= 0) return { container: cid, index: i };
  }
  return null;
}

/**
 * Compute the live preview order(s) for a drag hovering at (overContainer,
 * overIndex) with `activeId` sourced from `fromContainer`.
 *
 * Overflow rule: if the over-container is a top3 that is already full (3) and
 * the active item is not already in it, inserting displaces the 3rd member into
 * the over-day's "other" container HEAD — previewed live.
 *
 * Returns only the containers whose order changed.
 */
export function computePreview(
  base: ContainerMap,
  activeId: string,
  fromContainer: string,
  overContainer: string,
  overIndex: number,
): ContainerMap {
  const preview: ContainerMap = new Map();
  const fromIds = base.get(fromContainer) ?? [];
  const overIds = base.get(overContainer) ?? [];

  if (fromContainer === overContainer) {
    // Same-container reorder: plain arrayMove.
    const oldIndex = fromIds.indexOf(activeId);
    if (oldIndex < 0) return preview;
    preview.set(overContainer, arrayMove(fromIds, oldIndex, overIndex));
    return preview;
  }

  // Cross-container move. Remove active from its source.
  const nextFrom = fromIds.filter((id) => id !== activeId);
  preview.set(fromContainer, nextFrom);

  const over = parseContainerId(overContainer);
  const isTop3 =
    over?.kind === "top3" || over?.kind === "weekTop3" || over?.kind === "monthTop3";

  // Overflow: top3 already full and active isn't already a member.
  if (isTop3 && overIds.length >= 3 && !overIds.includes(activeId)) {
    const insertAt = Math.min(overIndex, 3);
    const inserted = [...overIds];
    inserted.splice(insertAt, 0, activeId);
    const displaced = inserted[3]; // the 4th now overflows
    const keep = inserted.slice(0, 3);
    preview.set(overContainer, keep);
    // Displaced lands at the HEAD of this column's pool: the day's "other" for a
    // day top3, the month's poolMonth ("其他任務") for a month top3. weekTop3 has
    // no in-column pool, so the displaced row simply leaves the visible set.
    const poolCid =
      over.kind === "top3"
        ? containerId({ kind: "other", date: over.date })
        : over.kind === "monthTop3"
          ? containerId({ kind: "poolMonth", month: over.month })
          : null;
    if (poolCid) {
      const poolIds = (preview.get(poolCid) ?? base.get(poolCid) ?? []).filter(
        (id) => id !== displaced,
      );
      preview.set(poolCid, [displaced, ...poolIds]);
    }
    return preview;
  }

  // Normal insert into the over-container.
  const inserted = overIds.filter((id) => id !== activeId);
  inserted.splice(Math.min(overIndex, inserted.length), 0, activeId);
  preview.set(overContainer, inserted);
  return preview;
}

// The action the DndContext should commit on drop. The handler maps these to
// store calls. Reusable across Day / Month / Week / Focus.
export type CommitPlan =
  | { kind: "none" }
  // Land in a three-things container at 1-based `rank`.
  | { kind: "rank"; taskId: string; rank: 1 | 2 | 3; axis: "daily" | "monthly"; scope: string }
  // Land in a pool between prev/next neighbours (real task ids, or null at ends).
  // The demotion axis + scope distinguish the day "other"/"adhoc" pools (daily,
  // scope = date) from the month "其他任務" pool (monthly, scope = month).
  | {
      kind: "pool";
      taskId: string;
      /** "daily" → day other/adhoc; "monthly" → month 其他任務. */
      axis: "daily" | "monthly";
      /** date (daily) or month (monthly). */
      scope: string;
      prevId: string | null;
      nextId: string | null;
      /** true when the task carried a priority on this axis and must be demoted first. */
      hadPriority: boolean;
      /** true when the task came from another column and must be scheduled first.
       *  Only ever set for the daily axis; month-pool reorder never schedules a day. */
      crossColumn: boolean;
    };

/**
 * Decide what to write, given the resolved drop target and the final preview
 * order. `activeTask` is the dragged task (real entity) so we can tell whether it
 * had a priority / came from another day.
 */
export function planCommit(args: {
  over: { container: string; index: number };
  finalOrder: string[]; // the over-container's order WITH active inserted
  activeId: string; // sortable id "day:<taskId>"
  activeTask: Task;
}): CommitPlan {
  const { over, finalOrder, activeId, activeTask } = args;
  const container = parseContainerId(over.container);
  if (!container) return { kind: "none" };
  const taskId = rowTaskId(activeId);
  const idx = finalOrder.indexOf(activeId);

  if (container.kind === "top3" || container.kind === "weekTop3") {
    const rank = (Math.min(idx < 0 ? over.index : idx, 2) + 1) as 1 | 2 | 3;
    return { kind: "rank", taskId, rank, axis: "daily", scope: container.date };
  }

  if (container.kind === "monthTop3") {
    const rank = (Math.min(idx < 0 ? over.index : idx, 2) + 1) as 1 | 2 | 3;
    return { kind: "rank", taskId, rank, axis: "monthly", scope: container.month };
  }

  if (container.kind === "other" || container.kind === "adhoc") {
    const prevId = idx > 0 ? rowTaskId(finalOrder[idx - 1]) : null;
    const nextId = idx >= 0 && idx < finalOrder.length - 1 ? rowTaskId(finalOrder[idx + 1]) : null;
    const hadPriority = Boolean(activeTask.custom_fields.daily_priority);
    const crossColumn = primaryDateOf(activeTask) !== container.date;
    return {
      kind: "pool",
      taskId,
      axis: "daily",
      scope: container.date,
      prevId,
      nextId,
      hadPriority,
      crossColumn,
    };
  }

  if (container.kind === "poolMonth") {
    const prevId = idx > 0 ? rowTaskId(finalOrder[idx - 1]) : null;
    const nextId = idx >= 0 && idx < finalOrder.length - 1 ? rowTaskId(finalOrder[idx + 1]) : null;
    const hadPriority = Boolean(activeTask.custom_fields.monthly_priority);
    // Month-pool reorder stays within the month column — never schedules a day.
    return {
      kind: "pool",
      taskId,
      axis: "monthly",
      scope: container.month,
      prevId,
      nextId,
      hadPriority,
      crossColumn: false,
    };
  }

  return { kind: "none" };
}

// Local primaryDate (avoid importing the whole tasks module surface twice).
function primaryDateOf(t: Task): string | null {
  const arr = t.custom_fields.scheduled_dates ?? [];
  if (arr.length === 0) return null;
  const last = arr[arr.length - 1];
  const u = t.custom_fields.unscheduled_at ?? "";
  return last > u ? last : null;
}
