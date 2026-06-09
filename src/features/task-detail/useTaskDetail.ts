import { useEffect, useState } from "react";
import type { Subtask } from "@/lib/types";
import { fetchSubtasks, createSubtask } from "@/lib/api/todo";
import { enqueuePatch } from "@/lib/api/todoQueue";
import { useTasksStore } from "@/store/tasks";

type Status = "loading" | "ready" | "error";

export function useTaskDetail(parentId: string | null) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  // `loadedFor` records which parent the current `subtasks` were fetched for, and
  // `errored` whether that fetch failed. Loading is DERIVED from these (below)
  // rather than set imperatively, so the effect never calls setState in its body
  // — every setState here lives in a `.then` callback (react-hooks/set-state-in-effect).
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);
  const bumpSubtaskCount = useTasksStore((s) => s.bumpSubtaskCount);

  useEffect(() => {
    // No parent (modal closed): skip the fetch; the closed case is derived below.
    if (!parentId) return;
    let alive = true;
    fetchSubtasks(parentId).then(
      (list) => { if (alive) { setSubtasks(list); setLoadedFor(parentId); setErrored(false); } },
      () => { if (alive) { setErrored(true); setLoadedFor(parentId); } },
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

  // Derive everything for the current parent during render. No parent → empty +
  // ready (modal closed). Subtasks not yet loaded for this parent → loading +
  // empty (also masks a stale list while switching tasks). Loaded → ready/error.
  const loaded = Boolean(parentId) && loadedFor === parentId;
  const status: Status = !parentId
    ? "ready"
    : !loaded
      ? "loading"
      : errored
        ? "error"
        : "ready";
  const visibleSubtasks = loaded ? subtasks : [];
  const total = visibleSubtasks.length;
  const done = visibleSubtasks.filter((s) => s.status === "done").length;

  return {
    subtasks: visibleSubtasks,
    status,
    total,
    done,
    add,
    toggle,
    rename,
    remove,
  };
}
