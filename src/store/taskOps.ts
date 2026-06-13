import type { Task, TaskCustomFields, Priority } from "@/lib/types";
import { primaryDate, primaryMonth } from "@/lib/tasks";
import { monthOf } from "@/lib/date";

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
    if (t.id === id) return patch(t, { daily_priority: n ?? undefined });
    // 騰位:只在今天 primary 的 task 之間清掉撞號者
    if (n !== null && primaryDate(t) === today && t.custom_fields.daily_priority === n) {
      return patch(t, { daily_priority: undefined });
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
    if (t.id === id) return patch(t, { monthly_priority: n ?? undefined });
    // eviction: clear the collider among this month's primary tasks
    if (n !== null && primaryMonth(t) === month && t.custom_fields.monthly_priority === n) {
      return patch(t, { monthly_priority: undefined });
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

