import { useState } from "react";
import type { Priority } from "@/lib/types";
import { useTasksStore } from "@/store/tasks";

export function useMonthRow(id: string, opts: { month: string; selectedDate: string }) {
  const toggleDone = useTasksStore((s) => s.toggleDone);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const editTitle = useTasksStore((s) => s.editTitle);
  const setMonthlyPriority = useTasksStore((s) => s.setMonthlyPriority);
  const setAdhoc = useTasksStore((s) => s.setAdhoc);
  const promoteToDay = useTasksStore((s) => s.promoteToDay);
  const current = useTasksStore((s) => s.tasks.find((t) => t.id === id));

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  return {
    isEditing,
    draft,
    toggle: () => toggleDone(id),
    remove: () => deleteTask(id),
    setPriority: (n: Priority | null) => setMonthlyPriority(id, n, opts.month),
    promote: () => promoteToDay(id, opts.selectedDate),
    toggleAdhoc: () => {
      const isAdhoc = current?.custom_fields.is_adhoc === "true";
      setAdhoc(id, !isAdhoc);
    },
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
