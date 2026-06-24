import { useState } from "react";
import type { Priority } from "@/lib/types";
import { useTasksStore } from "@/store/tasks";

export function useMonthRow(id: string, opts: { month: string; selectedDate: string }) {
  const toggleDone = useTasksStore((s) => s.toggleDone);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const editTitle = useTasksStore((s) => s.editTitle);
  const setMonthlyPriority = useTasksStore((s) => s.setMonthlyPriority);
  const reorderPriority = useTasksStore((s) => s.reorderPriority);
  const setAdhoc = useTasksStore((s) => s.setAdhoc);
  const planScheduleDay = useTasksStore((s) => s.planScheduleDay);
  const moveToNextMonth = useTasksStore((s) => s.moveToNextMonth);
  const demoteToBacklog = useTasksStore((s) => s.demoteToBacklog);
  const current = useTasksStore((s) => s.tasks.find((t) => t.id === id));

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  return {
    isEditing,
    draft,
    toggle: () => toggleDone(id),
    remove: () => deleteTask(id),
    setPriority: (n: Priority | null) =>
      n === null
        ? setMonthlyPriority(id, null, opts.month)
        : reorderPriority(id, n, "monthly", opts.month),
    // Schedule this task onto the focus date. With a priority it also lands in
    // that day's top-3 via reorderPriority (cascade + overflow); without one it
    // stays in the day's other-planned.
    promote: (priority: Priority | null = null) => {
      planScheduleDay(id, opts.selectedDate);
      if (priority) reorderPriority(id, priority, "daily", opts.selectedDate);
    },
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
    moveToNextMonth: () => moveToNextMonth(id),
    demoteToBacklog: () => demoteToBacklog(id),
  };
}
