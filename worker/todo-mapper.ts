import type { Todo } from "./wspc";
import type { Task, Subtask, TaskCustomFields } from "../src/lib/types";

export function mapTodoToTask(todo: Todo): Task {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description ? todo.description : undefined,
    subtask_count: todo.child_count ?? 0,
    status: todo.status,
    created_at: new Date(todo.created_at).toISOString(),
    updated_at: new Date(todo.updated_at).toISOString(),
    custom_fields: (todo.custom_fields ?? {}) as TaskCustomFields,
  };
}

export function mapTodoToSubtask(todo: Todo): Subtask {
  return { id: todo.id, title: todo.title, status: todo.status };
}
