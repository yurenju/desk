import { getBootstrap, putBootstrap, type BootstrapData } from "./kv";
import { createProject, createTodoType, updateTodoType, type CustomFieldDecl } from "./wspc";

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
  { key: "daily_ranks", type: "string_array" },
  { key: "monthly_ranks", type: "string_array" },
];

// Bump whenever DESK_TASK_FIELDS gains a field. ensureBootstrap reconciles an
// already-created type up to this version once (existing accounts predate the
// new field), so per-period ranks don't 422 with UNKNOWN_CUSTOM_FIELD.
const SCHEMA_VERSION = 2;

export async function ensureBootstrap(
  kv: KVNamespace,
  accessToken: string,
  userId: string,
): Promise<BootstrapData> {
  const existing = await getBootstrap(kv, userId);
  if (existing) {
    // Reconcile an older type to the current field set exactly once per bump.
    if ((existing.schemaVersion ?? 1) < SCHEMA_VERSION) {
      await updateTodoType(accessToken, existing.typeId, DESK_TASK_FIELDS);
      const synced: BootstrapData = { ...existing, schemaVersion: SCHEMA_VERSION };
      await putBootstrap(kv, userId, synced);
      return synced;
    }
    return existing;
  }

  const project = await createProject(accessToken, "Desk");
  const type = await createTodoType(accessToken, {
    label: "DeskTask",
    projectId: project.id,
    customFields: DESK_TASK_FIELDS,
  });
  const data: BootstrapData = {
    projectId: project.id,
    typeId: type.id,
    schemaVersion: SCHEMA_VERSION,
  };
  await putBootstrap(kv, userId, data);
  return data;
}
