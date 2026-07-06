import type { Todo, WspcComment } from "./wspc";
import type { Task, Subtask, TaskComment, TaskCustomFields } from "../src/lib/types";

export function mapTodoToTask(todo: Todo): Task {
  const custom_fields = { ...(todo.custom_fields ?? {}) } as TaskCustomFields;

  // A recurring occurrence carries its date in the native recurrence_occurrence_at
  // field, not in Desk's scheduled_dates custom field. Synthesize scheduled_dates
  // so layer()/tasksOnDate() place it on its day. Only when the user hasn't already
  // scheduled it (i.e. no scheduled_dates yet) — once moved, the real value wins.
  const hasScheduledDates =
    Array.isArray(custom_fields.scheduled_dates) && custom_fields.scheduled_dates.length > 0;
  if (todo.recurrence_occurrence_at && !hasScheduledDates) {
    custom_fields.scheduled_dates = [todo.recurrence_occurrence_at];
  }

  return {
    id: todo.id,
    title: todo.title,
    description: todo.description ? todo.description : undefined,
    subtask_count: todo.child_count ?? 0,
    status: todo.status,
    created_at: new Date(todo.created_at).toISOString(),
    updated_at: new Date(todo.updated_at).toISOString(),
    custom_fields,
    ...(todo.recurring_template_id ? { recurring: true } : {}),
  };
}

export function mapTodoToSubtask(todo: Todo): Subtask {
  return { id: todo.id, title: todo.title, status: todo.status };
}

// Drop user_id/org_id/todo_id: single-user app, the frontend only renders
// content and timestamps.
export function mapComment(comment: WspcComment): TaskComment {
  return {
    id: comment.id,
    content: comment.content,
    created_at: new Date(comment.created_at).toISOString(),
    updated_at: new Date(comment.updated_at).toISOString(),
  };
}
