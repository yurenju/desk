import { useEffect, useState } from "react";
import type { Task } from "@/lib/types";
import { fetchTodo } from "@/lib/api/todo";
import { enqueuePatch } from "@/lib/api/todoQueue";
import { useTasksStore } from "@/store/tasks";

/**
 * Resolve the task shown in the detail modal. Root tasks live in the tasks
 * store and use its optimistic actions; subtasks are absent from the root list,
 * so they are fetched on demand and mutated against a local copy with the same
 * optimistic-patch-rollback shape.
 */
export function useDetailTask(openId: string | null) {
  const storeTask = useTasksStore((s) => s.tasks.find((t) => t.id === openId) ?? null);
  const storeToggleDone = useTasksStore((s) => s.toggleDone);
  const storeEditTitle = useTasksStore((s) => s.editTitle);
  const storeEditDescription = useTasksStore((s) => s.editDescription);
  const storeDeleteTask = useTasksStore((s) => s.deleteTask);

  const [fetched, setFetched] = useState<Task | null>(null);
  const inStore = Boolean(storeTask);

  useEffect(() => {
    if (!openId || inStore) return;
    let alive = true;
    fetchTodo(openId).then(
      (t) => { if (alive) setFetched(t); },
      () => { /* modal shows nothing for this id; closing/back recovers */ },
    );
    return () => { alive = false; };
  }, [openId, inStore]);

  const task = storeTask ?? (fetched && fetched.id === openId ? fetched : null);

  function patchLocal(update: Partial<Task>) {
    setFetched((cur) => (cur ? { ...cur, ...update } : cur));
  }

  async function toggleDone() {
    if (!task) return;
    if (inStore) return storeToggleDone(task.id);
    const prevStatus = task.status;
    const next = prevStatus === "done" ? "open" : "done";
    patchLocal({ status: next });
    try {
      await enqueuePatch(task.id, { status: next });
    } catch {
      patchLocal({ status: prevStatus });
    }
  }

  async function editTitle(title: string) {
    if (!task) return;
    if (inStore) return storeEditTitle(task.id, title);
    const prevTitle = task.title;
    patchLocal({ title });
    try {
      await enqueuePatch(task.id, { title });
    } catch {
      patchLocal({ title: prevTitle });
    }
  }

  async function editDescription(description: string) {
    if (!task) return;
    if (inStore) return storeEditDescription(task.id, description);
    const prev = task.description;
    patchLocal({ description: description || undefined });
    try {
      await enqueuePatch(task.id, { description });
    } catch {
      patchLocal({ description: prev });
    }
  }

  // Detached delete awaits the patch so the parent's subtask refetch (triggered
  // by navigating back) no longer sees the cancelled child.
  async function remove() {
    if (!task) return;
    if (inStore) return storeDeleteTask(task.id);
    try {
      await enqueuePatch(task.id, { status: "cancelled" });
    } catch {
      /* stay put; nothing was removed */
    }
  }

  return { task, isDetached: !inStore, toggleDone, editTitle, editDescription, remove };
}
