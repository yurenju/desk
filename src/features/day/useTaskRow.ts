import { useState } from "react";
import type { Priority } from "@/lib/types";
import { isAdhoc } from "@/lib/tasks";
import { useTasksStore } from "@/store/tasks";

export function useTaskRow(id: string, date: string) {
  const toggleDone = useTasksStore((s) => s.toggleDone);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const editTitle = useTasksStore((s) => s.editTitle);
  const setDailyPriority = useTasksStore((s) => s.setDailyPriority);
  const reorderPriority = useTasksStore((s) => s.reorderPriority);
  const setAdhoc = useTasksStore((s) => s.setAdhoc);
  const moveToToday = useTasksStore((s) => s.moveToToday);
  const demoteToMonth = useTasksStore((s) => s.demoteToMonth);
  const restoreToDay = useTasksStore((s) => s.restoreToDay);
  const current = useTasksStore((s) => s.tasks.find((t) => t.id === id));

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  return {
    isEditing,
    draft,
    toggle: () => toggleDone(id),
    remove: () => deleteTask(id),
    setPriority: (n: Priority | null) =>
      n === null ? setDailyPriority(id, null, date) : reorderPriority(id, n, "daily", date),
    toggleAdhoc: () => {
      setAdhoc(id, !(current && isAdhoc(current)));
    },
    moveToToday: () => moveToToday(id),
    demoteToMonth: () => demoteToMonth(id),
    restoreToDay: () => restoreToDay(id, date),
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
