// Shared drag helpers for in-column sortable reordering (three-things + pools).
//
// Tasks 8-12 all reuse these: container-id parsing, the live overflow-preview
// computation, and the onDragEnd commit planner. PlanLayout / TodayLayout own the
// DndContext + preview state; this module is the pure logic they call into so the
// behaviour stays identical across Day / Month / Week / Focus.

import { arrayMove } from "@dnd-kit/sortable";
import {
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";
import type { Task } from "@/lib/types";
import { tasksOnDate, tasksOnMonth, tasksInBacklog, dayInWeek, byPosition } from "@/lib/tasks";
import { weekOf } from "@/lib/date";
import { useTasksStore } from "@/store/tasks";

// Sortable item ids reuse the existing day-row namespace: "day:<taskId>".
// Recover the real task id (mirrors PlanLayout.resolveTaskId but scoped to the
// sortable surfaces this module drives).
export function rowTaskId(sortableId: string): string {
  if (sortableId.startsWith("day:")) return sortableId.slice("day:".length);
  if (sortableId.startsWith("month:")) return sortableId.slice("month:".length);
  if (sortableId.startsWith("backlog:")) return sortableId.slice("backlog:".length);
  // week:<YYYY-MM-DD>:<taskId> — strip the first two colon-separated segments.
  if (sortableId.startsWith("week:")) {
    const afterDate = sortableId.indexOf(":", "week:".length);
    if (afterDate >= 0) return sortableId.slice(afterDate + 1);
  }
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

// Whether a dnd-kit hit id is one of our sortable surfaces: a container droppable
// (top3/other/adhoc/mtop3/poolMonth/...) or a sortable row member ("day:"/"month:").
export function isSortableHit(id: string, members: Set<string>): boolean {
  return isSortableContainerId(id) || members.has(id);
}

// Backlog sortable ids: "backlog:<taskId>" + the pool container "pool:backlog".
// These belong to BOTH the backlog SortableContext AND can be dragged cross-column
// onto day/week zones. We treat a backlog active row specially in collision detection.
export function isBacklogSortableId(id: string): boolean {
  return id.startsWith("backlog:") || id === "pool:backlog";
}

/**
 * Collision detection shared by PlanLayout (Day/Month/Week/Backlog) and
 * TodayLayout (Focus center only).
 *
 * pointerWithin keeps the over-cell exactly under the cursor (rectIntersection
 * would pick a neighbour via the drag ghost's larger rect, making the week hint
 * jump). But pointerWithin returns nothing when the pointer is in a gap between
 * droppables (e.g. the space between the Day column's top-3 and other zones),
 * which would silently drop the task; fall back to rectIntersection there.
 *
 * `sortableMembers` is the set of sortable row ids currently registered in the
 * base container map. A row id (e.g. "month:<id>") is a sortable surface ONLY
 * when it's a member — a Slice-4 month/week row that isn't in any container must
 * fall through to the coarse drop:* zones.
 */
export function makeCollisionDetection(sortableMembers: Set<string>): CollisionDetection {
  return (args) => {
    const within = pointerWithin(args);
    const hits = within.length > 0 ? within : rectIntersection(args);
    const activeId = String(args.active.id);
    const activeIsSortableRow = sortableMembers.has(activeId);

    // Backlog rows: sortable within pool:backlog, but also support cross-column
    // drops onto day/week zones. Prefer the backlog sortable surface when hovering
    // over it; otherwise fall through to coarse drop:* zones.
    if (activeIsSortableRow && activeId.startsWith("backlog:")) {
      const backlogSortableHits = hits.filter((h) => isBacklogSortableId(String(h.id)));
      if (backlogSortableHits.length > 0) return backlogSortableHits;
      // Not hovering over pool:backlog — allow Slice-4 coarse zones to take over.
      const zoneHits = hits.filter((h) => !isSortableHit(String(h.id), sortableMembers));
      return zoneHits.length > 0 ? zoneHits : hits;
    }

    // A sortable row is both a sortable (container + item ids) AND sits inside the
    // Slice-4 free-form drop zones (drop:day:<date>:* / drop:month). When an
    // in-column sortable row is the active drag, prefer the sortable hits so the
    // live reorder/overflow preview drives, not the coarse zone. The zones still
    // win for Slice-4 cross-column drags (backlog/trail rows), whose active id
    // isn't a sortable container member.
    if (activeIsSortableRow) {
      const sortableHits = hits.filter((h) => isSortableHit(String(h.id), sortableMembers));
      if (sortableHits.length > 0) return sortableHits;
      return hits;
    }
    // Slice-4 cross-column drag (trail row): the sortable container +
    // item droppables must NOT intercept — the coarse free-form drop:* zones own
    // these drops. Drop the sortable hits so the zone wins.
    const zoneHits = hits.filter((h) => !isSortableHit(String(h.id), sortableMembers));
    return zoneHits.length > 0 ? zoneHits : hits;
  };
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

/**
 * Derive the Week column's top-3 sortable containers — one per day in the given
 * week. For each date, container id `week:<date>:top3` maps to the day's top-3
 * sortable ids `week:<date>:<taskId>`. Mirrors WeekColumn's own top3 derivation
 * exactly (primary on date, has daily_priority, sorted by it, sliced to 3).
 * Only top-3 is sortable; the "other" zone is NOT included.
 */
export function buildWeekContainers(allTasks: Task[], weekDates: string[]): ContainerMap {
  const map: ContainerMap = new Map();
  for (const date of weekDates) {
    const primary = tasksOnDate(allTasks, date)
      .filter((e) => e.kind === "primary")
      .map((e) => e.task);
    const top3 = primary
      .filter((t) => t.custom_fields.daily_priority)
      .sort(
        (a, b) =>
          Number(a.custom_fields.daily_priority) - Number(b.custom_fields.daily_priority),
      )
      .slice(0, 3);
    map.set(containerId({ kind: "weekTop3", date }), top3.map((t) => `week:${date}:${t.id}`));
  }
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

  if (container.kind === "poolBacklog") {
    const prevId = idx > 0 ? rowTaskId(finalOrder[idx - 1]) : null;
    const nextId = idx >= 0 && idx < finalOrder.length - 1 ? rowTaskId(finalOrder[idx + 1]) : null;
    // Backlog tasks have no date, no priority, no scheduling — pure position reorder.
    return {
      kind: "pool",
      taskId,
      // axis/scope are not meaningful for backlog, but the CommitPlan type requires
      // them. Use "daily" + empty string as sentinel; commitPlan checks hadPriority +
      // crossColumn first and skips the scheduling/demotion branches for backlog.
      axis: "daily",
      scope: "",
      prevId,
      nextId,
      hadPriority: false,
      crossColumn: false,
    };
  }

  return { kind: "none" };
}

/**
 * Map a CommitPlan to store mutations. Shared by PlanLayout (Day/Month/Week/
 * Backlog) and TodayLayout (Focus center) so the commit behaviour stays identical.
 * Reads the store via getState() internally, so it's a plain async function.
 */
export async function commitPlan(plan: CommitPlan): Promise<void> {
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

/**
 * Derive the Backlog pool sortable container from the task list, mirroring
 * BacklogSection's own derivation (tasksInBacklog sorted by byPosition). Ids are
 * namespaced "backlog:<taskId>".
 */
export function buildBacklogContainer(allTasks: Task[]): ContainerMap {
  const items = tasksInBacklog(allTasks).sort((a, b) => byPosition(a, b));
  const map: ContainerMap = new Map();
  map.set(containerId({ kind: "poolBacklog" }), items.map((t) => `backlog:${t.id}`));
  return map;
}

// Local primaryDate (avoid importing the whole tasks module surface twice).
function primaryDateOf(t: Task): string | null {
  const arr = t.custom_fields.scheduled_dates ?? [];
  if (arr.length === 0) return null;
  const last = arr[arr.length - 1];
  const u = t.custom_fields.unscheduled_at ?? "";
  return last > u ? last : null;
}
