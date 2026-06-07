import { useState } from "react";
import type { Priority } from "@/lib/types";
import { monthOf } from "@/lib/date";
import { useTasksStore } from "@/store/tasks";

export function useBacklogRow(id: string, opts: { focusDate: string }) {
  const toggleDone = useTasksStore((s) => s.toggleDone);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const editTitle = useTasksStore((s) => s.editTitle);
  const promoteToMonth = useTasksStore((s) => s.promoteToMonth);
  const planScheduleDay = useTasksStore((s) => s.planScheduleDay);
  const setDailyPriority = useTasksStore((s) => s.setDailyPriority);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  return {
    isEditing,
    draft,
    toggle: () => toggleDone(id),
    remove: () => deleteTask(id),
    toMonth: () => promoteToMonth(id, monthOf(opts.focusDate)),
    // Schedule onto the focus day. With a priority it also lands in that day's
    // top-3 (setDailyPriority evicts the slot's prior occupant); without one it
    // stays in the day's other-planned.
    toDay: (priority: Priority | null = null) => {
      planScheduleDay(id, opts.focusDate);
      if (priority) setDailyPriority(id, priority, opts.focusDate);
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
