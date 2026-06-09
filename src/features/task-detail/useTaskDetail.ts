import { useEffect, useState } from "react";
import type { Subtask } from "@/lib/types";
import { fetchSubtasks, createSubtask } from "@/lib/api/todo";
import { enqueuePatch } from "@/lib/api/todoQueue";
import { useTasksStore } from "@/store/tasks";

type Status = "loading" | "ready" | "error";

export function useTaskDetail(parentId: string | null) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const bumpSubtaskCount = useTasksStore((s) => s.bumpSubtaskCount);

  useEffect(() => {
    if (!parentId) {
      setStatus("ready");
      setSubtasks([]);
      return;
    }
    let alive = true;
    setStatus("loading");
    fetchSubtasks(parentId).then(
      (list) => { if (alive) { setSubtasks(list); setStatus("ready"); } },
      () => { if (alive) setStatus("error"); },
    );
    return () => { alive = false; };
  }, [parentId]);

  // add is intentionally non-optimistic: the new subtask is appended only after
  // the server assigns its id. A failed add fails silently (no global status
  // flip) so one bad add never wipes the loaded list.
  async function add(title: string) {
    const trimmed = title.trim();
    if (!trimmed || !parentId) return;
    try {
      const created = await createSubtask(parentId, trimmed);
      setSubtasks((prev) => [...prev, created]);
      bumpSubtaskCount(parentId, 1);
    } catch {
      /* keep current state; surfacing add errors is a later polish */
    }
  }

  async function toggle(id: string) {
    const target = subtasks.find((s) => s.id === id);
    if (!target) return;
    const next = target.status === "done" ? "open" : "done";
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, status: next } : s)));
    try {
      await enqueuePatch(id, { status: next });
    } catch {
      setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, status: target.status } : s)));
    }
  }

  async function rename(id: string, title: string) {
    const trimmed = title.trim();
    const target = subtasks.find((s) => s.id === id);
    if (!trimmed || !target) return;
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s)));
    try {
      await enqueuePatch(id, { title: trimmed });
    } catch {
      setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, title: target.title } : s)));
    }
  }

  async function remove(id: string) {
    if (!parentId) return;
    const prev = subtasks;
    setSubtasks((cur) => cur.filter((s) => s.id !== id));
    bumpSubtaskCount(parentId, -1);
    try {
      await enqueuePatch(id, { status: "cancelled" });
    } catch {
      setSubtasks(prev);
      bumpSubtaskCount(parentId, 1);
    }
  }

  const total = subtasks.length;
  const done = subtasks.filter((s) => s.status === "done").length;

  return { subtasks, status, total, done, add, toggle, rename, remove };
}
