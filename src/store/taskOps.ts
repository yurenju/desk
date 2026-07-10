import type { Task, TaskCustomFields, Priority } from "@/lib/types";
import { primaryDate, primaryMonth, nextFreeDailySlot, dailyRankOn, monthlyRankOn } from "@/lib/tasks";
import { writeRank } from "@/lib/ranks";
import { monthOf, addMonths } from "@/lib/date";
import { midpoint } from "@/lib/order";

function patch(t: Task, cf: Partial<TaskCustomFields>, now?: string): Task {
  const newCustomFields = { ...t.custom_fields, ...cf };
  for (const key of Object.keys(newCustomFields)) {
    if (newCustomFields[key as keyof TaskCustomFields] === undefined) {
      delete newCustomFields[key as keyof TaskCustomFields];
    }
  }
  return {
    ...t,
    ...(now ? { updated_at: now } : {}),
    custom_fields: newCustomFields,
  };
}

export function toggleDone(tasks: Task[], id: string, now: string): Task[] {
  if (!tasks.some((t) => t.id === id)) return tasks;
  return tasks.map((t) => {
    if (t.id !== id) return t;
    const isDone = t.status === "done";
    return {
      ...patch(t, { done_on: isDone ? undefined : now }, now),
      status: isDone ? "open" : "done",
    };
  });
}

export function addTodayTask(
  tasks: Task[],
  title: string,
  today: string,
  id: string,
  now: string,
  isAdhoc: boolean,
): Task[] {
  const trimmed = title.trim();
  if (!trimmed) return tasks;
  const task: Task = {
    id,
    title: trimmed,
    status: "open",
    created_at: now,
    updated_at: now,
    custom_fields: { scheduled_dates: [today], is_adhoc: isAdhoc ? "true" : "false" },
  };
  return [...tasks, task];
}

export function editTitle(tasks: Task[], id: string, title: string, now: string): Task[] {
  const trimmed = title.trim();
  if (!trimmed) return tasks;
  if (!tasks.some((t) => t.id === id)) return tasks;
  return tasks.map((t) => (t.id === id ? { ...t, title: trimmed, updated_at: now } : t));
}

export interface RemovedTask {
  task: Task;
  index: number;
}

export function deleteTask(
  tasks: Task[],
  id: string,
): { tasks: Task[]; removed: RemovedTask | null } {
  const index = tasks.findIndex((t) => t.id === id);
  if (index < 0) return { tasks, removed: null };
  const removed: RemovedTask = { task: tasks[index], index };
  return { tasks: tasks.filter((t) => t.id !== id), removed };
}

export function restoreTask(tasks: Task[], removed: RemovedTask | null | undefined): Task[] {
  if (!removed) return tasks;
  const next = [...tasks];
  next.splice(removed.index, 0, removed.task);
  return next;
}

export function setDailyPriority(
  tasks: Task[],
  id: string,
  n: Priority | null,
  today: string,
): Task[] {
  if (!tasks.some((t) => t.id === id)) return tasks;
  return tasks.map((t) => {
    if (t.id === id) {
      const ranks = writeRank(t.custom_fields.daily_ranks, today, n, {
        value: t.custom_fields.daily_priority,
        key: primaryDate(t),
      });
      return patch(t, { daily_ranks: ranks, daily_priority: undefined });
    }
    // eviction: clear the collider among THIS date's ranked tasks
    if (n !== null && dailyRankOn(t, today) === n) {
      const ranks = writeRank(t.custom_fields.daily_ranks, today, null, {
        value: t.custom_fields.daily_priority,
        key: primaryDate(t),
      });
      return patch(t, { daily_ranks: ranks, daily_priority: undefined });
    }
    return t;
  });
}

export function setAdhoc(tasks: Task[], id: string, isAdhoc: boolean): Task[] {
  if (!tasks.some((t) => t.id === id)) return tasks;
  return tasks.map((t) =>
    t.id === id ? patch(t, { is_adhoc: isAdhoc ? "true" : "false" }) : t,
  );
}

export function setMonthlyPriority(
  tasks: Task[],
  id: string,
  n: Priority | null,
  month: string,
): Task[] {
  if (!tasks.some((t) => t.id === id)) return tasks;
  return tasks.map((t) => {
    if (t.id === id) {
      const ranks = writeRank(t.custom_fields.monthly_ranks, month, n, {
        value: t.custom_fields.monthly_priority,
        key: primaryMonth(t),
      });
      return patch(t, { monthly_ranks: ranks, monthly_priority: undefined });
    }
    // eviction: clear the collider among this month's ranked tasks
    if (n !== null && monthlyRankOn(t, month) === n) {
      const ranks = writeRank(t.custom_fields.monthly_ranks, month, null, {
        value: t.custom_fields.monthly_priority,
        key: primaryMonth(t),
      });
      return patch(t, { monthly_ranks: ranks, monthly_priority: undefined });
    }
    return t;
  });
}

export function addMonthTask(
  tasks: Task[],
  title: string,
  month: string,
  id: string,
  now: string,
  isAdhoc: boolean,
): Task[] {
  const trimmed = title.trim();
  if (!trimmed) return tasks;
  const task: Task = {
    id,
    title: trimmed,
    status: "open",
    created_at: now,
    updated_at: now,
    custom_fields: { scheduled_months: [month], is_adhoc: isAdhoc ? "true" : "false" },
  };
  return [...tasks, task];
}

export function addBacklogTask(tasks: Task[], title: string, id: string, now: string): Task[] {
  const trimmed = title.trim();
  if (!trimmed) return tasks;
  const task: Task = {
    id,
    title: trimmed,
    status: "open",
    created_at: now,
    updated_at: now,
    custom_fields: { scheduled_months: [], scheduled_dates: [], is_adhoc: "false" },
  };
  return [...tasks, task];
}

export function promoteToMonth(tasks: Task[], id: string, month: string): Task[] {
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;
  const months = target.custom_fields.scheduled_months ?? [];
  if (months[months.length - 1] === month) return tasks; // already there
  return tasks.map((t) =>
    t.id === id ? patch(t, { scheduled_months: [...months, month] }) : t,
  );
}

export function planScheduleDay(tasks: Task[], id: string, date: string): Task[] {
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;
  const month = monthOf(date);
  const dates = target.custom_fields.scheduled_dates ?? [];
  const hasPrimaryDate = primaryDate(target) !== null;

  let nextDates: string[];
  if (dates[dates.length - 1] === date) nextDates = dates;
  else if (hasPrimaryDate) nextDates = [...dates.slice(0, -1), date];
  else nextDates = [...dates, date];

  const months = target.custom_fields.scheduled_months ?? [];
  // Re-scheduling to a day reactivates/ensures the month is the active primary month,
  // even if it was previously dismissed (primaryMonth === null). Intentional backfill.
  const nextMonths = primaryMonth(target) === month ? months : [...months, month];

  if (nextDates === dates && nextMonths === months) return tasks; // no change

  return tasks.map((t) =>
    t.id === id ? patch(t, { scheduled_dates: nextDates, scheduled_months: nextMonths }) : t,
  );
}

export function moveToToday(tasks: Task[], id: string, today: string): Task[] {
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;
  const dates = target.custom_fields.scheduled_dates ?? [];
  if (dates[dates.length - 1] === today) return tasks; // already on today

  const nextDates = [...dates, today]; // append-only: origin day stays as a trail

  // The source day's rank stays in `daily_ranks` untouched (preserved history).
  // For TODAY, if the task actually had a rank on its source day, reassign it a
  // fresh non-colliding slot. If today's three-things is already full (all 3
  // slots taken by OTHERS), set no rank on today (land in "其他計劃內") rather
  // than evict a deliberate pick. Always clear the legacy single field.
  const sourceDay = primaryDate(target);
  const hadSourceRank = sourceDay !== null && dailyRankOn(target, sourceDay) !== null;

  let nextRanks = target.custom_fields.daily_ranks;
  if (hadSourceRank) {
    const takenByOthers = new Set(
      tasks
        .filter((t) => t.id !== id && dailyRankOn(t, today) !== null)
        .map((t) => dailyRankOn(t, today)),
    );
    if (takenByOthers.size < 3) {
      const slot = nextFreeDailySlot(tasks, today, id);
      nextRanks = writeRank(target.custom_fields.daily_ranks, today, slot, {
        value: target.custom_fields.daily_priority,
        key: primaryDate(target),
      });
    }
  }

  return tasks.map((t) =>
    t.id === id
      ? patch(t, { scheduled_dates: nextDates, daily_ranks: nextRanks, daily_priority: undefined })
      : t,
  );
}

/**
 * Restore a trail row (forwarded or dismissed) back to being `date`'s regular
 * planned open task, i.e. make `primaryDate(target) === date`.
 *
 * Same append/replace rules as planScheduleDay, plus one extra step: clear
 * `unscheduled_at`. A dismissed row has `unscheduled_at === date`, which would
 * otherwise keep primaryDate null no matter what we append. For a forwarded row
 * (no unscheduled_at) this is equivalent to planScheduleDay.
 */
export function restoreToDay(tasks: Task[], id: string, date: string): Task[] {
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;
  const month = monthOf(date);
  const dates = target.custom_fields.scheduled_dates ?? [];
  const hasPrimaryDate = primaryDate(target) !== null;

  let nextDates: string[];
  if (dates[dates.length - 1] === date) nextDates = dates;
  else if (hasPrimaryDate) nextDates = [...dates.slice(0, -1), date];
  else nextDates = [...dates, date];

  const months = target.custom_fields.scheduled_months ?? [];
  // Reactivate the target month (same backfill as planScheduleDay).
  const nextMonths = primaryMonth(target) === month ? months : [...months, month];

  // daily_ranks stay untouched (preserved history); clear the legacy single field.
  return tasks.map((t) =>
    t.id === id
      ? patch(t, {
          scheduled_dates: nextDates,
          scheduled_months: nextMonths,
          unscheduled_at: undefined,
          daily_priority: undefined,
        })
      : t,
  );
}

export function demoteToMonth(tasks: Task[], id: string, currentMonth: string): Task[] {
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;
  const day = primaryDate(target);
  if (day === null) return tasks; // not on a day, nothing to demote

  const months = target.custom_fields.scheduled_months ?? [];
  // Land in the current month (今天所在月), unless it's already the active month.
  const nextMonths = primaryMonth(target) === currentMonth ? months : [...months, currentMonth];

  // The day's rank entry IS the preserved history, so the dismissed row stays in
  // place in the day's Top3 card (greyed, "↩ 已退回本月") instead of vanishing.
  // Fold any legacy single value into daily_ranks[day] first — once primaryDate
  // becomes null the legacy read-fallback no longer fires, so the rank must live
  // in the array to survive. This is a no-op write when daily_ranks already
  // carries the day's rank. Clear the legacy single field afterwards.
  const dayRank = dailyRankOn(target, day);
  const nextRanks = writeRank(target.custom_fields.daily_ranks, day, dayRank, {
    value: target.custom_fields.daily_priority,
    key: day,
  });

  return tasks.map((t) =>
    t.id === id
      ? patch(t, {
          unscheduled_at: day, // dismiss the day (= last scheduled date); scheduled_dates trail stays
          scheduled_months: nextMonths,
          daily_ranks: nextRanks,
          daily_priority: undefined,
        })
      : t,
  );
}

export function moveToNextMonth(tasks: Task[], id: string): Task[] {
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;
  const months = target.custom_fields.scheduled_months ?? [];
  if (months.length === 0) return tasks; // not a month task
  const last = months[months.length - 1];
  const nextMonth = monthOf(addMonths(`${last}-01`, 1));
  // Leave monthly_ranks untouched: the source month's rank entry is preserved
  // history; the new month simply has no rank. Clear the legacy single field so
  // the read fallback can't resurrect a stale value on the new primary month.
  return tasks.map((t) =>
    t.id === id
      ? patch(t, { scheduled_months: [...months, nextMonth], monthly_priority: undefined })
      : t,
  );
}

export function demoteToBacklog(tasks: Task[], id: string, today: string): Task[] {
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;
  const months = target.custom_fields.scheduled_months ?? [];
  if (months.length === 0) return tasks; // already backlog
  const dates = target.custom_fields.scheduled_dates ?? [];
  const lastDate = dates[dates.length - 1];
  // Dismiss any residual day scheduling — including a day in the future — so the
  // task truly lands in backlog. Stamp the later of `today` and the last scheduled day.
  const dismissAt = lastDate && lastDate > today ? lastDate : today;
  // Leave daily_ranks/monthly_ranks untouched (preserved history); backlog has
  // no rank entry of its own. Clear the legacy single fields so the read
  // fallback can't resurrect a stale value.
  return tasks.map((t) =>
    t.id === id
      ? patch(t, {
          unscheduled_month: months[months.length - 1], // dismiss active month
          unscheduled_at: dismissAt,
          monthly_priority: undefined,
          daily_priority: undefined,
        })
      : t,
  );
}

type Axis = "daily" | "monthly";

function rankFieldsFor(axis: Axis): {
  ranksField: "daily_ranks" | "monthly_ranks";
  legacyField: "daily_priority" | "monthly_priority";
} {
  return axis === "daily"
    ? { ranksField: "daily_ranks", legacyField: "daily_priority" }
    : { ranksField: "monthly_ranks", legacyField: "monthly_priority" };
}

/** This task's rank on `scope` for the given axis (per-period array, else legacy
 * fallback on the current primary period). */
function rankOf(t: Task, axis: Axis, scope: string): Priority | null {
  return axis === "daily" ? dailyRankOn(t, scope) : monthlyRankOn(t, scope);
}

function legacyKeyOf(t: Task, axis: Axis): string | null {
  return axis === "daily" ? primaryDate(t) : primaryMonth(t);
}

function isPrimaryOnScope(t: Task, axis: Axis, scope: string): boolean {
  return axis === "daily" ? primaryDate(t) === scope : primaryMonth(t) === scope;
}

/**
 * Insert `id` at `targetRank` among the scope's top-3, cascading lower ranks
 * down by one. If that pushes a task past rank 3, it overflows: its priority is
 * cleared and it gets a `position` sorting before the scope's current "other"
 * pool (lands in the first "其他" slot). Single source of truth for both drag
 * and menu/ring rank assignment.
 */
export function reorderPriority(
  tasks: Task[],
  id: string,
  targetRank: Priority,
  axis: Axis,
  scope: string,
): Task[] {
  const { ranksField, legacyField } = rankFieldsFor(axis);
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;

  // Write `rank` (or null to clear) for this scope, folding any legacy single
  // value into its primary period and clearing the legacy field.
  const writeScopeRank = (t: Task, rank: Priority | null): Task => {
    const ranks = writeRank(t.custom_fields[ranksField], scope, rank, {
      value: t.custom_fields[legacyField],
      key: legacyKeyOf(t, axis),
    });
    return patch(t, { [ranksField]: ranks, [legacyField]: undefined });
  };

  // Current ranked members on this scope (excluding the task being placed).
  const ranked = tasks
    .filter((t) => t.id !== id && rankOf(t, axis, scope) !== null)
    .sort((a, b) => Number(rankOf(a, axis, scope)) - Number(rankOf(b, axis, scope)));

  // Build the new ordered list of ids: insert `id` at (targetRank-1).
  const order = ranked.map((t) => t.id);
  const insertAt = Math.min(Number(targetRank) - 1, order.length);
  order.splice(insertAt, 0, id);

  // First three keep ranks 1/2/3; anything past index 2 overflows.
  const newRank = new Map<string, Priority>();
  order.slice(0, 3).forEach((tid, i) => newRank.set(tid, String(i + 1) as Priority));
  const overflowId = order.length > 3 ? order[3] : null;

  // Overflow position = before the scope's current "other" pool min.
  let overflowPos: string | null = null;
  if (overflowId) {
    const poolMin = tasks
      .filter(
        (t) =>
          t.id !== overflowId &&
          isPrimaryOnScope(t, axis, scope) &&
          rankOf(t, axis, scope) === null &&
          t.custom_fields.position,
      )
      .map((t) => t.custom_fields.position!)
      .sort()[0];
    overflowPos = midpoint(null, poolMin ?? null);
  }

  return tasks.map((t) => {
    if (t.id === overflowId) {
      const ranks = writeRank(t.custom_fields[ranksField], scope, null, {
        value: t.custom_fields[legacyField],
        key: legacyKeyOf(t, axis),
      });
      return patch(t, {
        [ranksField]: ranks,
        [legacyField]: undefined,
        position: overflowPos ?? undefined,
      });
    }
    const r = newRank.get(t.id);
    if (r) return writeScopeRank(t, r);
    // A previously-ranked task that fell out of the top-3 set but is not the
    // single tracked overflow (shouldn't happen with cap 3, but stay safe):
    if (rankOf(t, axis, scope) !== null && !newRank.has(t.id)) {
      return writeScopeRank(t, null);
    }
    return t;
  });
}

export function reorderInPool(
  tasks: Task[],
  id: string,
  prevId: string | null,
  nextId: string | null,
): Task[] {
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;
  const prevPos = prevId ? (tasks.find((t) => t.id === prevId)?.custom_fields.position ?? null) : null;
  const nextPos = nextId ? (tasks.find((t) => t.id === nextId)?.custom_fields.position ?? null) : null;
  const pos = midpoint(prevPos, nextPos);
  return tasks.map((t) => (t.id === id ? patch(t, { position: pos }) : t));
}

