import type { Task } from "@/lib/types";
import { patchTodoApi, type TodoPatch } from "./todo";

interface Waiter {
  resolve: (task: Task) => void;
  reject: (err: unknown) => void;
}

interface QueueEntry {
  // Patch accumulated while a request for this id is in flight.
  pendingPatch: TodoPatch | null;
  // Callers waiting for the coalesced pending batch to settle.
  pendingWaiters: Waiter[];
}

// One entry per todo id. Presence of an entry means a request for that id is
// currently in flight; an idle id has no entry.
const queues = new Map<string, QueueEntry>();

// Test-only: drop all queue state between tests.
export function resetTodoQueue(): void {
  queues.clear();
}

export function enqueuePatch(id: string, patch: TodoPatch): Promise<Task> {
  const entry = queues.get(id);
  if (!entry) {
    // No in-flight request for this id: send immediately.
    queues.set(id, { pendingPatch: null, pendingWaiters: [] });
    const p = patchTodoApi(id, patch);
    p.then(
      () => flush(id),
      (err) => abort(id, err),
    );
    return p;
  }
  // A request is in flight: merge this patch into the pending batch and wait.
  entry.pendingPatch = { ...(entry.pendingPatch ?? {}), ...patch };
  return new Promise<Task>((resolve, reject) => {
    entry.pendingWaiters.push({ resolve, reject });
  });
}

function flush(id: string): void {
  const entry = queues.get(id);
  if (!entry) return;
  if (entry.pendingPatch === null) {
    // Nothing accumulated: the id is now idle.
    queues.delete(id);
    return;
  }
  const patch = entry.pendingPatch;
  const batch = entry.pendingWaiters;
  entry.pendingPatch = null;
  entry.pendingWaiters = [];
  patchTodoApi(id, patch).then(
    (task) => {
      batch.forEach((w) => w.resolve(task));
      flush(id);
    },
    (err) => {
      batch.forEach((w) => w.reject(err));
      abort(id, err);
    },
  );
}

function abort(id: string, err: unknown): void {
  const entry = queues.get(id);
  if (!entry) return;
  const waiters = entry.pendingWaiters;
  queues.delete(id);
  waiters.forEach((w) => w.reject(err));
}
