export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";

export type TrailKind = "primary" | "forwarded" | "dismissed";

export type Priority = "1" | "2" | "3";

export type Layer = "backlog" | "monthly" | "daily";

export interface TaskCustomFields {
  scheduled_months?: string[];
  scheduled_dates?: string[];
  unscheduled_month?: string;
  unscheduled_at?: string;
  monthly_priority?: Priority;
  daily_priority?: Priority;
  is_adhoc?: "true" | "false";
  done_on?: string;
  position?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  custom_fields: TaskCustomFields;
}

export interface TaskWithTrail {
  task: Task;
  kind: TrailKind;
}
