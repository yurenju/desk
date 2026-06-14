import type { Task, TaskCustomFields, Priority } from "@/lib/types";
import { primaryDate, primaryMonth, nextFreeDailySlot } from "@/lib/tasks";
import { monthOf, addMonths } from "@/lib/date";

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

export function moveToToday(tasks: Task[], id: string, today: string): Task[] {
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;
  const dates = target.custom_fields.scheduled_dates ?? [];
  if (dates[dates.length - 1] === today) return tasks; // already on today

  const nextDates = [...dates, today]; // append-only: origin day stays as a trail

  // Preserve "is a priority", but the exact slot doesn't matter — reassign to a
  // non-colliding slot on today. If today's three-things is already full, drop
  // the priority (land in "其他計劃內") rather than evict a deliberate pick.
  let nextPriority = target.custom_fields.daily_priority;
  if (nextPriority) {
    const takenByOthers = new Set(
      tasks
        .filter((t) => t.id !== id && primaryDate(t) === today && t.custom_fields.daily_priority)
        .map((t) => t.custom_fields.daily_priority),
    );
    nextPriority = takenByOthers.size >= 3 ? undefined : nextFreeDailySlot(tasks, today, id);
  }

  return tasks.map((t) =>
    t.id === id ? patch(t, { scheduled_dates: nextDates, daily_priority: nextPriority }) : t,
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

  return tasks.map((t) =>
    t.id === id
      ? patch(t, {
          unscheduled_at: day, // dismiss the day (= last scheduled date); scheduled_dates trail stays
          scheduled_months: nextMonths,
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
  return tasks.map((t) =>
    t.id === id
      ? patch(t, {
          unscheduled_month: months[months.length - 1], // dismiss active month
          unscheduled_at: today, // a month task may have no active day; stamp "now" to dismiss any residual day scheduling
          monthly_priority: undefined,
          daily_priority: undefined,
        })
      : t,
  );
}

