import type { Todo } from "./wspc";
import type { Task, TaskCustomFields } from "../src/lib/types";

export function mapTodoToTask(todo: Todo): Task {
  return {
    id: todo.id,
    title: todo.title,
    status: todo.status,
    created_at: new Date(todo.created_at).toISOString(),
    updated_at: new Date(todo.updated_at).toISOString(),
    custom_fields: (todo.custom_fields ?? {}) as TaskCustomFields,
  };
}
