import type { Task, Subtask, TaskStatus } from "@/lib/types";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`api ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchTodos(): Promise<Task[]> {
  const res = await fetch(`/api/todo`, { credentials: "same-origin" });
  const data = await jsonOrThrow<{ tasks: Task[] }>(res);
  return data.tasks;
}

export interface CreateTodoInput {
  title: string;
  scheduled_dates?: string[];
  scheduled_months?: string[];
  is_adhoc?: "true" | "false";
}

export async function postTodo(input: CreateTodoInput): Promise<Task> {
  const res = await fetch("/api/todo", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ task: Task }>(res);
  return data.task;
}

export interface TodoPatch {
  status?: TaskStatus;
  daily_priority?: string | null;
  monthly_priority?: string | null;
  position?: string | null;
  done_on?: string | null;
  is_adhoc?: "true" | "false";
  title?: string;
  description?: string;
  scheduled_dates?: string[];
  scheduled_months?: string[];
  unscheduled_at?: string;
  unscheduled_month?: string;
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

export async function fetchSubtasks(parentId: string): Promise<Subtask[]> {
  const res = await fetch(`/api/todo/${encodeURIComponent(parentId)}/subtasks`, {
    credentials: "same-origin",
  });
  const data = await jsonOrThrow<{ subtasks: Subtask[] }>(res);
  return data.subtasks;
}

export async function createSubtask(parentId: string, title: string): Promise<Subtask> {
  const res = await fetch(`/api/todo/${encodeURIComponent(parentId)}/subtasks`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const data = await jsonOrThrow<{ subtask: Subtask }>(res);
  return data.subtask;
}
