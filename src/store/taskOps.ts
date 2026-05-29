import type { Task, TaskCustomFields } from "@/lib/types";

function patch(t: Task, cf: Partial<TaskCustomFields>, now?: string): Task {
  const newCustomFields = { ...t.custom_fields, ...cf };
  for (const key in newCustomFields) {
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

