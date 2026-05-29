import type { Task, TaskCustomFields } from "@/lib/types";

function patch(t: Task, cf: Partial<TaskCustomFields>, now?: string): Task {
  return {
    ...t,
    ...(now ? { updated_at: now } : {}),
    custom_fields: { ...t.custom_fields, ...cf },
  };
}

export function toggleDone(tasks: Task[], id: string, now: string): Task[] {
  return tasks.map((t) => {
    if (t.id !== id) return t;
    const isDone = t.status === "done";
    return {
      ...patch(t, { done_on: isDone ? undefined : now }, now),
      status: isDone ? "open" : "done",
    };
  });
}
