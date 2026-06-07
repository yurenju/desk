import type { Task, TaskWithTrail, Layer, TrailKind, Priority } from "./types";

export function primaryMonth(t: Task): string | null {
  const arr = t.custom_fields.scheduled_months ?? [];
  if (arr.length === 0) return null;
  const last = arr[arr.length - 1];
  const u = t.custom_fields.unscheduled_month ?? "";
  return last > u ? last : null;
}

export function primaryDate(t: Task): string | null {
  const arr = t.custom_fields.scheduled_dates ?? [];
  if (arr.length === 0) return null;
  const last = arr[arr.length - 1];
  const u = t.custom_fields.unscheduled_at ?? "";
  return last > u ? last : null;
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
 */
export function nextFreeDailySlot(all: Task[], date: string): Priority {
  const taken = new Set(
    all
      .filter((t) => primaryDate(t) === date && t.custom_fields.daily_priority)
      .map((t) => t.custom_fields.daily_priority),
  );
  if (!taken.has("1")) return "1";
  if (!taken.has("2")) return "2";
  return "3";
}
