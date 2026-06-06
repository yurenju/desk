import type { Task, TaskStatus } from "@/lib/types";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`api ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchTodos(date: string): Promise<Task[]> {
  const res = await fetch(`/api/todo?date=${encodeURIComponent(date)}`, {
    credentials: "same-origin",
  });
  const data = await jsonOrThrow<{ tasks: Task[] }>(res);
  return data.tasks;
}

export async function postTodo(title: string, date: string): Promise<Task> {
  const res = await fetch("/api/todo", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, date }),
  });
  const data = await jsonOrThrow<{ task: Task }>(res);
  return data.task;
}

export interface TodoPatch {
  status?: TaskStatus;
  daily_priority?: string | null;
  done_on?: string | null;
  is_adhoc?: "true" | "false";
  title?: string;
}

export async function patchTodoApi(id: string, patch: TodoPatch): Promise<Task> {
  const res = await fetch(`/api/todo/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await jsonOrThrow<{ task: Task }>(res);
  return data.task;
}
