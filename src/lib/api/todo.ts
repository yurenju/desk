import type { Task, Subtask, TaskComment, TaskStatus } from "@/lib/types";

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
  unscheduled_at?: string | null;
  unscheduled_month?: string;
  daily_ranks?: string[];
  monthly_ranks?: string[];
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

// Single-todo fetch, used by the detail modal for subtasks (absent from the
// root fetchTodos list and thus from the tasks store).
export async function fetchTodo(id: string): Promise<Task> {
  const res = await fetch(`/api/todo/${encodeURIComponent(id)}`, { credentials: "same-origin" });
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

export async function fetchComments(taskId: string): Promise<TaskComment[]> {
  const res = await fetch(`/api/todo/${encodeURIComponent(taskId)}/comments`, {
    credentials: "same-origin",
  });
  const data = await jsonOrThrow<{ comments: TaskComment[] }>(res);
  return data.comments;
}

export async function createComment(taskId: string, content: string): Promise<TaskComment> {
  const res = await fetch(`/api/todo/${encodeURIComponent(taskId)}/comments`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const data = await jsonOrThrow<{ comment: TaskComment }>(res);
  return data.comment;
}

export async function updateComment(commentId: string, content: string): Promise<TaskComment> {
  const res = await fetch(`/api/todo/comments/${encodeURIComponent(commentId)}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const data = await jsonOrThrow<{ comment: TaskComment }>(res);
  return data.comment;
}

export async function deleteComment(commentId: string): Promise<void> {
  const res = await fetch(`/api/todo/comments/${encodeURIComponent(commentId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error(`api ${res.status}`);
}
