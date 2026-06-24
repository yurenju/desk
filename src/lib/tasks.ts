import type { Task, TaskWithTrail, Layer, TrailKind, Priority } from "./types";

export function primaryMonth(t: Task): string | null {
  const arr = t.custom_fields.scheduled_months ?? [];
  if (arr.length === 0) return null;
  const last = arr[arr.length - 1];
  const u = t.custom_fields.unscheduled_month ?? "";
  return last > u ? last : null;
}

export type DelayKind = "none" | "dismissed" | "carried";

/**
 * Delay signal for a task shown in `month`'s plan column.
 * - "carried": scheduled in a month earlier than `month` (still dragging on).
 * - "dismissed": was put on a day this month then bounced back to the month layer.
 * "carried" wins when both apply (it is the heavier signal).
 */
export function delayKind(t: Task, month: string): DelayKind {
  const months = t.custom_fields.scheduled_months ?? [];
  if (months.some((m) => m < month)) return "carried";
  const u = t.custom_fields.unscheduled_at ?? "";
  if (u.startsWith(month)) return "dismissed";
  return "none";
}

export interface DelaySummary {
  carriedMonths: number;
  earliestMonth: string | null;
  dismissedDate: string | null;
}

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

/** The two conclusions the task-detail page shows: how long it has been
 * carried across months, and whether it was bounced off a day this month. */
export function delaySummary(t: Task, month: string): DelaySummary {
  const months = t.custom_fields.scheduled_months ?? [];
  const earlier = months.filter((m) => m < month);
  const earliestMonth = earlier.length ? earlier.reduce((a, b) => (a < b ? a : b)) : null;
  const carriedMonths = earliestMonth ? monthsBetween(earliestMonth, month) : 0;
  const u = t.custom_fields.unscheduled_at ?? "";
  const dismissedDate = u.startsWith(month) ? u : null;
  return { carriedMonths, earliestMonth, dismissedDate };
}

export function primaryDate(t: Task): string | null {
  const arr = t.custom_fields.scheduled_dates ?? [];
  if (arr.length === 0) return null;
  const last = arr[arr.length - 1];
  const u = t.custom_fields.unscheduled_at ?? "";
  return last > u ? last : null;
}

/** The task's effective day if it falls within `week` (the 7 ISO dates from
 * weekOf), else null. Used to mark month tasks already placed in the viewed week. */
export function dayInWeek(t: Task, week: string[]): string | null {
  const d = primaryDate(t);
  return d && week.includes(d) ? d : null;
}

/**
 * Whether the "+ 計劃外" chip should show for a task in the day column on `date`.
 * The chip flags a genuine same-day ad-hoc insertion, not any task that merely
 * has `is_adhoc === "true"` (which by itself is noise — most tasks pass through
 * an adhoc add at some point). Rule (ROADMAP Slice 7): adhoc AND created on
 * `date` AND scheduled only for `date`.
 */
export function isDayAdhocChip(t: Task, date: string): boolean {
  if (t.custom_fields.is_adhoc !== "true") return false;
  if (t.created_at.slice(0, 10) !== date) return false;
  const dates = t.custom_fields.scheduled_dates ?? [];
  return dates.length > 0 && dates.every((d) => d === date);
}

export function layer(t: Task): Layer {
  if (primaryDate(t)) return "daily";
  if (primaryMonth(t)) return "monthly";
  return "backlog";
}

export function tasksOnDate(all: Task[], date: string): TaskWithTrail[] {
  return all
    .filter((t) => t.custom_fields.scheduled_dates?.includes(date))
    .map((t): TaskWithTrail => {
      const arr = t.custom_fields.scheduled_dates!;
      const last = arr[arr.length - 1];
      const u = t.custom_fields.unscheduled_at ?? "";
      let kind: TrailKind;
      if (date === last && last > u) kind = "primary";
      else if (date === last && last === u) kind = "dismissed";
      else kind = "forwarded";
      return { task: t, kind };
    });
}

export function tasksOnMonth(all: Task[], month: string): TaskWithTrail[] {
  return all
    .filter((t) => t.custom_fields.scheduled_months?.includes(month))
    .map((t): TaskWithTrail => {
      const arr = t.custom_fields.scheduled_months!;
      const last = arr[arr.length - 1];
      const u = t.custom_fields.unscheduled_month ?? "";
      let kind: TrailKind;
      if (month === last && last > u) kind = "primary";
      else if (month === last && last === u) kind = "dismissed";
      else kind = "forwarded";
      return { task: t, kind };
    });
}

export function tasksInBacklog(all: Task[]): Task[] {
  return all.filter(
    (t) => layer(t) === "backlog" && t.status !== "done" && t.status !== "cancelled",
  );
}

/**
 * The first free daily_priority slot (1→2→3) among tasks primary on `date`.
 * Returns "3" when all three are taken, so the caller's setDailyPriority can
 * evict slot 3's current occupant (same day ring eviction semantics).
 *
 * Pass `excludeId` to ignore a specific task when computing taken slots — useful
 * when the task being placed has already been moved to `date` but still carries
 * its old priority (e.g. during drag-and-drop re-scheduling).
 */
export function nextFreeDailySlot(all: Task[], date: string, excludeId?: string): Priority {
  const taken = new Set(
    all
      .filter((t) => t.id !== excludeId && primaryDate(t) === date && t.custom_fields.daily_priority)
      .map((t) => t.custom_fields.daily_priority),
  );
  if (!taken.has("1")) return "1";
  if (!taken.has("2")) return "2";
  return "3";
}
