import { getBootstrap, putBootstrap, type BootstrapData } from "./kv";
import { createProject, createTodoType, type CustomFieldDecl } from "./wspc";

const DESK_TASK_FIELDS: CustomFieldDecl[] = [
  { key: "scheduled_months", type: "string_array" },
  { key: "scheduled_dates", type: "string_array" },
  { key: "unscheduled_month", type: "string" },
  { key: "unscheduled_at", type: "string" },
  { key: "monthly_priority", type: "string" },
  { key: "daily_priority", type: "string" },
  { key: "is_adhoc", type: "string" },
  { key: "done_on", type: "string" },
  { key: "position", type: "string" },
];

export async function ensureBootstrap(
  kv: KVNamespace,
  accessToken: string,
  userId: string,
): Promise<BootstrapData> {
  const existing = await getBootstrap(kv, userId);
  if (existing) return existing;

  const project = await createProject(accessToken, "Desk");
  const type = await createTodoType(accessToken, {
    label: "DeskTask",
    projectId: project.id,
    customFields: DESK_TASK_FIELDS,
  });
  const data: BootstrapData = { projectId: project.id, typeId: type.id };
  await putBootstrap(kv, userId, data);
  return data;
}
