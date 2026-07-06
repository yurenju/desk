import { useEffect, useState } from "react";
import type { TaskComment } from "@/lib/types";
import { fetchComments, createComment, updateComment, deleteComment } from "@/lib/api/todo";

type Status = "loading" | "ready" | "error";

// Same shape as useTaskDetail: fetch on open, loading derived from loadedFor so
// the effect never sets state in its body. Comments are discrete entities, so
// mutations call the API directly (no patch-queue coalescing needed).
export function useComments(taskId: string | null) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    let alive = true;
    fetchComments(taskId).then(
      (list) => { if (alive) { setComments(list); setLoadedFor(taskId); setErrored(false); } },
      () => { if (alive) { setErrored(true); setLoadedFor(taskId); } },
    );
    return () => { alive = false; };
  }, [taskId]);

  // Non-optimistic like subtask add: append only once the server assigns an id.
  async function add(content: string) {
    const trimmed = content.trim();
    if (!trimmed || !taskId) return;
    try {
      const created = await createComment(taskId, trimmed);
      setComments((prev) => [...prev, created]);
    } catch {
      /* keep current state; surfacing add errors is a later polish */
    }
  }

  async function edit(id: string, content: string) {
    const trimmed = content.trim();
    const target = comments.find((c) => c.id === id);
    if (!trimmed || !target || trimmed === target.content) return;
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, content: trimmed, updated_at: new Date().toISOString() } : c)),
    );
    try {
      const updated = await updateComment(id, trimmed);
      setComments((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch {
      setComments((prev) => prev.map((c) => (c.id === id ? target : c)));
    }
  }

  async function remove(id: string) {
    const prev = comments;
    setComments((cur) => cur.filter((c) => c.id !== id));
    try {
      await deleteComment(id);
    } catch {
      setComments(prev);
    }
  }

  const loaded = Boolean(taskId) && loadedFor === taskId;
  const status: Status = !taskId ? "ready" : !loaded ? "loading" : errored ? "error" : "ready";

  return {
    comments: loaded ? comments : [],
    status,
    add,
    edit,
    remove,
  };
}
