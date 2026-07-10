import { useEffect, useState } from "react";
import type { Subtask } from "@/lib/types";
import { fetchSubtasks, createSubtask } from "@/lib/api/todo";
import { enqueuePatch } from "@/lib/api/todoQueue";
import { useTasksStore } from "@/store/tasks";
import { midpoint } from "@/lib/order";

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
    const doneDelta = next === "done" ? 1 : -1;
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, status: next } : s)));
    if (parentId) bumpSubtaskCount(parentId, 0, doneDelta);
    try {
      await enqueuePatch(id, { status: next });
    } catch {
      setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, status: target.status } : s)));
      if (parentId) bumpSubtaskCount(parentId, 0, -doneDelta);
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
    const wasDone = subtasks.find((s) => s.id === id)?.status === "done" ? 1 : 0;
    setSubtasks((cur) => cur.filter((s) => s.id !== id));
    bumpSubtaskCount(parentId, -1, -wasDone);
    try {
      await enqueuePatch(id, { status: "cancelled" });
    } catch {
      setSubtasks(prev);
      bumpSubtaskCount(parentId, 1, wasDone);
    }
  }

  // Drag reorder: move `activeId` to `overId`'s slot, then walk the new order
  // and give a fresh `midpoint` key to any subtask whose position no longer
  // sorts (the moved one always does — its old key is discarded — and, when
  // positions were never set, the whole list gets a key chain in one pass).
  // The server's position-first sort then reproduces this order on reload.
  async function reorder(activeId: string, overId: string) {
    if (activeId === overId) return;
    const prev = subtasks;
    const from = prev.findIndex((s) => s.id === activeId);
    const to = prev.findIndex((s) => s.id === overId);
    if (from < 0 || to < 0) return;
    const moved = [...prev];
    moved.splice(to, 0, ...moved.splice(from, 1));

    const patches: { id: string; position: string }[] = [];
    let prevPos: string | null = null;
    const next = moved.map((s, i) => {
      let pos = s.id === activeId ? null : (s.position ?? null);
      if (!pos || (prevPos !== null && pos <= prevPos)) {
        const upper =
          moved
            .slice(i + 1)
            .find((n) => n.id !== activeId && n.position && (!prevPos || n.position > prevPos!))
            ?.position ?? null;
        pos = midpoint(prevPos, upper);
        patches.push({ id: s.id, position: pos });
      }
      prevPos = pos;
      return pos === s.position ? s : { ...s, position: pos };
    });

    setSubtasks(next);
    try {
      await Promise.all(patches.map((p) => enqueuePatch(p.id, { position: p.position })));
    } catch {
      setSubtasks(prev);
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
    reorder,
  };
}
