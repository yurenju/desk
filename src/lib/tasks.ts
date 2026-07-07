import type { Task, TaskWithTrail, Layer, TrailKind, Priority } from "./types";
import { shortDate, monthOf } from "./date";
import { rankOn } from "./ranks";

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

/** Whether the task is marked ad-hoc (計劃外). Single home for the string-typed
 *  custom-field comparison so call sites read as intent. */
export function isAdhoc(t: Task): boolean {
  return t.custom_fields.is_adhoc === "true";
}

/**
 * Whether the "+ 計劃外" chip should show for a task in the day column on `date`.
 * The chip flags a genuine same-day ad-hoc insertion, not any task that merely
 * has `is_adhoc === "true"` (which by itself is noise — most tasks pass through
 * an adhoc add at some point). Rule (ROADMAP Slice 7): adhoc AND created on
 * `date` AND scheduled only for `date`.
 */
export function isDayAdhocChip(t: Task, date: string): boolean {
  if (!isAdhoc(t)) return false;
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

/**
 * Human-facing "moved to where" label for a non-primary (trail) day row, shown
 * in place after a task is moved out of the day it was viewed on. Replaces the
 * old generic "已順延 / 退回月度" with an explicit destination so the row doesn't
 * read as if it silently vanished.
 */
export function trailLabel(task: Task, kind: TrailKind, today: string): string {
  if (kind === "forwarded") {
    const dates = task.custom_fields.scheduled_dates ?? [];
    const target = dates[dates.length - 1];
    if (!target) return "↪ 已移走";
    return target === today ? "↪ 已移到今天" : `↪ 已移到 ${shortDate(target)}`;
  }
  // dismissed: bounced off the day back to its month (or all the way to backlog).
  const pm = primaryMonth(task);
  if (pm === null) return "↩ 已退回待辦";
  if (pm === monthOf(today)) return "↩ 已退回本月";
  return `↩ 已退回 ${Number(pm.slice(5))} 月`;
}

/**
 * Month-side mirror of `trailLabel`: the destination label for a non-primary
 * (trail) month row, so a task moved out of the month it was viewed on reads as
 * "moved to N月" instead of a bare arrow.
 */
export function monthTrailLabel(task: Task, kind: TrailKind): string {
  if (kind === "forwarded") {
    const months = task.custom_fields.scheduled_months ?? [];
    const target = months[months.length - 1];
    if (!target) return "↪ 已移走";
    return `↪ 已移到 ${Number(target.slice(5))} 月`;
  }
  // dismissed: bounced off this month back to backlog.
  return "↩ 已退回待辦";
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

/** Sort comparator for manually-ordered pools. Tasks with a `position` come
 * first (ascending string); tasks without keep their incoming relative order
 * (Array.prototype.sort is stable), so unset tasks fall back to store order. */
export function byPosition(a: Task, b: Task): number {
  const pa = a.custom_fields.position;
  const pb = b.custom_fields.position;
  if (pa && pb) return pa < pb ? -1 : pa > pb ? 1 : 0;
  if (pa && !pb) return -1;
  if (!pa && pb) return 1;
  return 0;
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
      .filter((t) => t.id !== excludeId && dailyRankOn(t, date))
      .map((t) => dailyRankOn(t, date)),
  );
  if (!taken.has("1")) return "1";
  if (!taken.has("2")) return "2";
  return "3";
}

/** This task's rank on `date`: per-date array first, else the legacy single
 * value but only on its current primary day (so a moved-out trail day shows no
 * stale rank). */
export function dailyRankOn(task: Task, date: string): Priority | null {
  const direct = rankOn(task.custom_fields.daily_ranks, date);
  if (direct) return direct;
  if (!task.custom_fields.daily_ranks?.length && primaryDate(task) === date) {
    return task.custom_fields.daily_priority ?? null;
  }
  return null;
}

/** Monthly mirror of dailyRankOn. */
export function monthlyRankOn(task: Task, month: string): Priority | null {
  const direct = rankOn(task.custom_fields.monthly_ranks, month);
  if (direct) return direct;
  if (!task.custom_fields.monthly_ranks?.length && primaryMonth(task) === month) {
    return task.custom_fields.monthly_priority ?? null;
  }
  return null;
}
