import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Priority, Task } from "@/lib/types";
import { fetchTodos, postTodo, type TodoPatch } from "@/lib/api/todo";
import { enqueuePatch as enqueuePatchRaw, trackCreate } from "@/lib/api/todoQueue";
import {
  addTodayTask,
  addMonthTask as addMonthTaskOp,
  addBacklogTask as addBacklogTaskOp,
  promoteToMonth as promoteToMonthOp,
  planScheduleDay as planScheduleDayOp,
  moveToToday as moveToTodayOp,
  demoteToMonth as demoteToMonthOp,
  restoreToDay as restoreToDayOp,
  moveToNextMonth as moveToNextMonthOp,
  demoteToBacklog as demoteToBacklogOp,
  deleteTask,
  editTitle,
  restoreTask as restoreTaskOp,
  setAdhoc as setAdhocOp,
  setDailyPriority,
  setMonthlyPriority as setMonthlyPriorityOp,
  toggleDone,
  reorderPriority as reorderPriorityOp,
  reorderInPool as reorderInPoolOp,
} from "./taskOps";
import type { RemovedTask } from "./taskOps";
import { deriveTodoPatch } from "./applyOp";
import { todayISO, currentMonthISO } from "@/lib/date";

const now = () => new Date().toISOString();

// Monotonic counter used to sequence reload calls. Only the most-recent
// invocation is allowed to commit its result to the store.
let loadSeq = 0;

// A completed server write proves connectivity is back, so clear a stale
// "unsynced" flag. Failures propagate unchanged (callers handle rollback).
// Note: references `useTasksStore` (declared below) — safe because this runs
// only at call time, after the store is created, never during module eval.
function enqueuePatch(id: string, patch: TodoPatch): Promise<Task> {
  return enqueuePatchRaw(id, patch).then((task) => {
    if (!useTasksStore.getState().synced) useTasksStore.setState({ synced: true });
    return task;
  });
}

interface TasksState {
  tasks: Task[];
  today: string;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  recentlyDeleted: RemovedTask | null;
  synced: boolean;
  loadTasks: () => Promise<void>;
  reload: () => Promise<void>;
  apply: (transform: (tasks: Task[]) => Task[]) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  addTodayTask: (title: string, date: string, isAdhoc: boolean) => Promise<void>;
  editTitle: (id: string, title: string) => Promise<void>;
  editDescription: (id: string, description: string) => Promise<void>;
  bumpSubtaskCount: (id: string, delta: number, doneDelta?: number) => void;
  setSubtaskCounts: (id: string, total: number, done: number) => void;
  deleteTask: (id: string) => Promise<void>;
  restoreTask: () => Promise<void>;
  setDailyPriority: (id: string, n: Priority | null, date: string) => Promise<void>;
  setAdhoc: (id: string, isAdhoc: boolean) => Promise<void>;
  setMonthlyPriority: (id: string, n: Priority | null, month: string) => Promise<void>;
  addMonthTask: (title: string, month: string, isAdhoc: boolean) => Promise<void>;
  addBacklogTask: (title: string) => Promise<void>;
  promoteToMonth: (id: string, month: string) => Promise<void>;
  planScheduleDay: (id: string, date: string) => Promise<void>;
  moveToToday: (id: string) => Promise<void>;
  demoteToMonth: (id: string) => Promise<void>;
  restoreToDay: (id: string, date: string) => Promise<void>;
  moveToNextMonth: (id: string) => Promise<void>;
  demoteToBacklog: (id: string) => Promise<void>;
  reorderPriority: (id: string, targetRank: Priority, axis: "daily" | "monthly", scope: string) => Promise<void>;
  reorderInPool: (id: string, prevId: string | null, nextId: string | null) => Promise<void>;
  clearTasks: () => void;
  clearRecentlyDeleted: () => void;
  clearError: () => void;
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: [],
      today: todayISO(),
      status: "idle",
      error: null,
      recentlyDeleted: null,
      synced: true,

  async loadTasks() {
    const st = get().status;
    if (st === "ready" || st === "loading") return; // load-once
    await get().reload();
  },

  async reload() {
    const seq = ++loadSeq;
    set({ status: "loading", error: null });
    try {
      const tasks = await fetchTodos();
      if (seq !== loadSeq) return;          // a newer load superseded this one
      set({ tasks, today: todayISO(), status: "ready", synced: true });
    } catch {
      if (seq !== loadSeq) return;
      // With cached tasks on screen, stay put and flag "unsynced" instead of
      // blanking to a full-screen error. Only cold-start-with-no-cache errors out.
      if (get().tasks.length > 0) {
        set({ status: "ready", synced: false });
      } else {
        set({ status: "error", error: "load_failed" });
      }
    }
  },

  /**
   * The single optimistic-write path for field-mutation ops. Runs a pure
   * transform, commits it optimistically, and persists only the fields each
   * touched task actually changed (derived via deriveTodoPatch — the op owns the
   * state change, this owns "what to send"). On failure: a single-id change rolls
   * back to `prev`; a multi-id change reloads from the server, because a partial
   * Promise.all failure can't be un-done coherently one id at a time.
   */
  async apply(transform) {
    const prev = get().tasks;
    const next = transform(prev);
    if (next === prev) return; // no-op transform: don't touch state or network
    const prevById = new Map(prev.map((t) => [t.id, t]));
    const patches = next
      .filter((t) => prevById.has(t.id) && prevById.get(t.id) !== t)
      .map((t) => ({ id: t.id, patch: deriveTodoPatch(prevById.get(t.id)!, t) }))
      .filter(({ patch }) => Object.keys(patch).length > 0);
    set({ tasks: next, error: null });
    if (patches.length === 0) return; // reference changed but nothing persistable
    try {
      await Promise.all(patches.map(({ id, patch }) => enqueuePatch(id, patch)));
    } catch {
      if (patches.length > 1) {
        try {
          await get().reload();
        } catch {
          /* reload already set status:"error" */
        }
      } else {
        set({ tasks: prev, error: "save_failed" });
      }
    }
  },

  async toggleDone(id) {
    await get().apply((prev) => toggleDone(prev, id, now()));
  },

  async addTodayTask(title, date, isAdhoc) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const prev = get().tasks;
    const tempId = `temp-${crypto.randomUUID()}`;
    set({ tasks: addTodayTask(prev, trimmed, date, tempId, now(), isAdhoc), error: null });
    const create = postTodo({
      title: trimmed,
      scheduled_dates: [date],
      is_adhoc: isAdhoc ? "true" : "false",
    });
    trackCreate(tempId, create);
    try {
      const created = await create;
      // Keep the optimistic task (incl. any action taken during the create
      // window) and only adopt the real id — replacing wholesale with `created`
      // would clobber those window changes. ponytail: server timestamps/version
      // aren't adopted here; next reload reconciles them (version is unused by
      // our optimistic-locking-free patches).
      set({ tasks: get().tasks.map((t) => (t.id === tempId ? { ...t, id: created.id } : t)) });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async editTitle(id, title) {
    const trimmed = title.trim();
    if (!trimmed) return;
    await get().apply((prev) => editTitle(prev, id, trimmed, now()));
  },

  async editDescription(id, description) {
    // Store the raw string (incl. "") so a cleared description derives a
    // `description: ""` wire patch — the removed→null differ rule is for
    // custom fields; the top-level description clears with an empty string.
    await get().apply((prev) =>
      prev.map((t) => (t.id === id ? { ...t, description, updated_at: now() } : t)),
    );
  },

  bumpSubtaskCount(id, delta, doneDelta = 0) {
    set({
      tasks: get().tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              subtask_count: Math.max(0, (t.subtask_count ?? 0) + delta),
              subtask_done: Math.max(0, (t.subtask_done ?? 0) + doneDelta),
            }
          : t,
      ),
    });
  },

  // Authoritative counts from a full subtask fetch (the detail modal), fixing
  // any parent the list route skipped or whose cached counts drifted.
  setSubtaskCounts(id, total, done) {
    set({
      tasks: get().tasks.map((t) =>
        t.id === id ? { ...t, subtask_count: total, subtask_done: done } : t,
      ),
    });
  },

  async deleteTask(id) {
    const prev = get().tasks;
    const { tasks, removed } = deleteTask(prev, id);
    if (!removed) return;
    set({ tasks, error: null, recentlyDeleted: removed });
    try {
      await enqueuePatch(id, { status: "cancelled" });
    } catch {
      set({ tasks: prev, error: "save_failed", recentlyDeleted: null });
    }
  },

  async restoreTask() {
    const removed = get().recentlyDeleted;
    if (!removed) return;
    const prev = get().tasks;
    set({ tasks: restoreTaskOp(prev, removed), recentlyDeleted: null, error: null });
    try {
      await enqueuePatch(removed.task.id, { status: removed.task.status });
    } catch {
      set({ tasks: prev, recentlyDeleted: removed, error: "save_failed" });
    }
  },

  async setDailyPriority(id, n, date) {
    await get().apply((prev) => setDailyPriority(prev, id, n, date));
  },

  async setAdhoc(id, isAdhoc) {
    await get().apply((prev) => setAdhocOp(prev, id, isAdhoc));
  },

  async setMonthlyPriority(id, n, month) {
    await get().apply((prev) => setMonthlyPriorityOp(prev, id, n, month));
  },

  async addMonthTask(title, month, isAdhoc) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const prev = get().tasks;
    const tempId = `temp-${crypto.randomUUID()}`;
    set({ tasks: addMonthTaskOp(prev, trimmed, month, tempId, now(), isAdhoc), error: null });
    const create = postTodo({
      title: trimmed,
      scheduled_months: [month],
      is_adhoc: isAdhoc ? "true" : "false",
    });
    trackCreate(tempId, create);
    try {
      const created = await create;
      set({ tasks: get().tasks.map((t) => (t.id === tempId ? { ...t, id: created.id } : t)) });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async addBacklogTask(title) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const prev = get().tasks;
    const tempId = `temp-${crypto.randomUUID()}`;
    set({ tasks: addBacklogTaskOp(prev, trimmed, tempId, now()), error: null });
    const create = postTodo({ title: trimmed, is_adhoc: "false" });
    trackCreate(tempId, create);
    try {
      const created = await create;
      set({ tasks: get().tasks.map((t) => (t.id === tempId ? { ...t, id: created.id } : t)) });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async promoteToMonth(id, month) {
    await get().apply((prev) => promoteToMonthOp(prev, id, month));
  },

  async planScheduleDay(id, date) {
    await get().apply((prev) => planScheduleDayOp(prev, id, date));
  },

  async moveToToday(id) {
    await get().apply((prev) => moveToTodayOp(prev, id, get().today));
  },

  async demoteToMonth(id) {
    const month = currentMonthISO(new Date(get().today + "T00:00:00"));
    await get().apply((prev) => demoteToMonthOp(prev, id, month));
  },

  async restoreToDay(id, date) {
    await get().apply((prev) => restoreToDayOp(prev, id, date));
  },

  async moveToNextMonth(id) {
    await get().apply((prev) => moveToNextMonthOp(prev, id));
  },

  async demoteToBacklog(id) {
    await get().apply((prev) => demoteToBacklogOp(prev, id, get().today));
  },

  async reorderPriority(id, targetRank, axis, scope) {
    await get().apply((prev) => reorderPriorityOp(prev, id, targetRank, axis, scope));
  },

  async reorderInPool(id, prevId, nextId) {
    await get().apply((prev) => reorderInPoolOp(prev, id, prevId, nextId));
  },

  clearTasks() {
    set({ tasks: [], status: "idle", error: null, recentlyDeleted: null });
  },

  clearRecentlyDeleted() {
    set({ recentlyDeleted: null });
  },

  clearError() {
    set({ error: null });
  },
    }),
    {
      name: "desk-tasks",
      partialize: (s) => ({ tasks: s.tasks }),
    },
  ),
);
