import { useState } from "react";
import type { Priority } from "@/lib/types";
import { useTasksStore } from "@/store/tasks";

function nextPriority(p: Priority | null): Priority | null {
  if (p === null) return "1";
  if (p === "1") return "2";
  if (p === "2") return "3";
  return null;
}

export function useTaskRow(id: string) {
  const toggleDone = useTasksStore((s) => s.toggleDone);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const editTitle = useTasksStore((s) => s.editTitle);
  const setDailyPriority = useTasksStore((s) => s.setDailyPriority);
  const current = useTasksStore((s) => s.tasks.find((t) => t.id === id));

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  return {
    isEditing,
    draft,
    toggle: () => toggleDone(id),
    remove: () => deleteTask(id),
    cyclePriority: () =>
      setDailyPriority(id, nextPriority(current?.custom_fields.daily_priority ?? null)),
    startEdit: (initial: string) => {
      setDraft(initial);
      setIsEditing(true);
    },
    changeDraft: (v: string) => setDraft(v),
    commitEdit: () => {
      editTitle(id, draft);
      setIsEditing(false);
    },
    cancelEdit: () => setIsEditing(false),
  };
}
