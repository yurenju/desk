import { useState } from "react";
import type { Priority, Task } from "@/lib/types";
import { primaryDate } from "@/lib/tasks";
import { useTasksStore } from "@/store/tasks";

function nextPriority(p: Priority | null): Priority | null {
  if (p === null) return "1";
  if (p === "1") return "2";
  if (p === "2") return "3";
  return null;
}

const PRIORITY_SLOTS: Priority[] = ["1", "2", "3"];

function nextFreeSlot(tasks: Task[], today: string): Priority | null {
  const used = new Set(
    tasks
      .filter((t) => primaryDate(t) === today && t.custom_fields.daily_priority)
      .map((t) => t.custom_fields.daily_priority),
  );
  return PRIORITY_SLOTS.find((p) => !used.has(p)) ?? null;
}

export function useTaskRow(id: string) {
  const toggleDone = useTasksStore((s) => s.toggleDone);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const editTitle = useTasksStore((s) => s.editTitle);
  const setDailyPriority = useTasksStore((s) => s.setDailyPriority);
  const tasks = useTasksStore((s) => s.tasks);
  const today = useTasksStore((s) => s.today);
  const current = tasks.find((t) => t.id === id);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  return {
    isEditing,
    draft,
    toggle: () => toggleDone(id),
    remove: () => deleteTask(id),
    cyclePriority: () => {
      const currentPriority = current?.custom_fields.daily_priority ?? null;
      if (currentPriority === null) {
        // promote into the next free slot without evicting others
        const free = nextFreeSlot(tasks, today);
        if (free !== null) setDailyPriority(id, free);
      } else {
        setDailyPriority(id, nextPriority(currentPriority));
      }
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
