import type { Task, TaskCustomFields } from "@/lib/types";

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
): Task[] {
  const trimmed = title.trim();
  if (!trimmed) return tasks;
  const task: Task = {
    id,
    title: trimmed,
    status: "open",
    parent_id: null,
    created_at: now,
    updated_at: now,
    custom_fields: { scheduled_dates: [today], is_adhoc: "true" },
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

export function restoreTask(tasks: Task[], removed: RemovedTask): Task[] {
  const next = [...tasks];
  next.splice(removed.index, 0, removed.task);
  return next;
}
