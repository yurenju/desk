import { create } from "zustand";
import type { Priority, Task } from "@/lib/types";
import { fetchTodos, postTodo } from "@/lib/api/todo";
import { enqueuePatch, trackCreate } from "@/lib/api/todoQueue";
import {
  addTodayTask,
  addMonthTask as addMonthTaskOp,
  addBacklogTask as addBacklogTaskOp,
  promoteToMonth as promoteToMonthOp,
  planScheduleDay as planScheduleDayOp,
  moveToToday as moveToTodayOp,
  demoteToMonth as demoteToMonthOp,
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
import { todayISO, currentMonthISO } from "@/lib/date";

const now = () => new Date().toISOString();

// Monotonic counter used to sequence reload calls. Only the most-recent
// invocation is allowed to commit its result to the store.
let loadSeq = 0;

interface TasksState {
  tasks: Task[];
  today: string;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  recentlyDeleted: RemovedTask | null;
  loadTasks: () => Promise<void>;
  reload: () => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  addTodayTask: (title: string, date: string, isAdhoc: boolean) => Promise<void>;
  editTitle: (id: string, title: string) => Promise<void>;
  editDescription: (id: string, description: string) => Promise<void>;
  bumpSubtaskCount: (id: string, delta: number) => void;
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
  moveToNextMonth: (id: string) => Promise<void>;
  demoteToBacklog: (id: string) => Promise<void>;
  reorderPriority: (id: string, targetRank: Priority, axis: "daily" | "monthly", scope: string) => Promise<void>;
  reorderInPool: (id: string, prevId: string | null, nextId: string | null) => Promise<void>;
  clearTasks: () => void;
  clearRecentlyDeleted: () => void;
  clearError: () => void;
}

export const useTasksStore = create<TasksState>()((set, get) => ({
  tasks: [],
  today: todayISO(),
  status: "idle",
  error: null,
  recentlyDeleted: null,

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
      set({ tasks, today: todayISO(), status: "ready" });
    } catch {
      if (seq !== loadSeq) return;
      set({ status: "error", error: "load_failed" });
    }
  },

  async toggleDone(id) {
    const prev = get().tasks;
    const target = prev.find((t) => t.id === id);
    if (!target) return;
    const willBeDone = target.status !== "done";
    const stamp = now();
    set({ tasks: toggleDone(prev, id, stamp), error: null });
    try {
      await enqueuePatch(id, {
        status: willBeDone ? "done" : "open",
        done_on: willBeDone ? stamp : null,
      });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
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
    const prev = get().tasks;
    set({ tasks: editTitle(prev, id, trimmed, now()), error: null });
    try {
      await enqueuePatch(id, { title: trimmed });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async editDescription(id, description) {
    const prev = get().tasks;
    set({
      tasks: prev.map((t) => (t.id === id ? { ...t, description: description || undefined } : t)),
      error: null,
    });
    try {
      await enqueuePatch(id, { description });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  bumpSubtaskCount(id, delta) {
    set({
      tasks: get().tasks.map((t) =>
        t.id === id ? { ...t, subtask_count: Math.max(0, (t.subtask_count ?? 0) + delta) } : t,
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
    const prev = get().tasks;
    const next = setDailyPriority(prev, id, n, date);
    set({ tasks: next, error: null });
    const changed = next.filter((t) => {
      const before = prev.find((p) => p.id === t.id);
      return (
        before &&
        JSON.stringify(before.custom_fields.daily_ranks ?? []) !==
          JSON.stringify(t.custom_fields.daily_ranks ?? [])
      );
    });
    try {
      await Promise.all(
        changed.map((t) =>
          enqueuePatch(t.id, {
            daily_ranks: t.custom_fields.daily_ranks ?? [],
            daily_priority: null,
          }),
        ),
      );
    } catch {
      // Unlike other mutations we do NOT roll back to `prev` here: Promise.all
      // may span multiple ids and some may have already been patched, so a
      // per-call rollback would leave priorities inconsistent. Reload from the
      // server to restore a coherent state instead. reload handles its own
      // failures internally (sets status:"error"); the extra try makes that
      // contract explicit at the call site and guards against future drift.
      try {
        await get().reload();
      } catch {
        /* reload already set status:"error" */
      }
    }
  },

  async setAdhoc(id, isAdhoc) {
    const prev = get().tasks;
    set({ tasks: setAdhocOp(prev, id, isAdhoc), error: null });
    try {
      await enqueuePatch(id, { is_adhoc: isAdhoc ? "true" : "false" });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async setMonthlyPriority(id, n, month) {
    const prev = get().tasks;
    const next = setMonthlyPriorityOp(prev, id, n, month);
    set({ tasks: next, error: null });
    const changed = next.filter((t) => {
      const before = prev.find((p) => p.id === t.id);
      return (
        before &&
        JSON.stringify(before.custom_fields.monthly_ranks ?? []) !==
          JSON.stringify(t.custom_fields.monthly_ranks ?? [])
      );
    });
    try {
      await Promise.all(
        changed.map((t) =>
          enqueuePatch(t.id, {
            monthly_ranks: t.custom_fields.monthly_ranks ?? [],
            monthly_priority: null,
          }),
        ),
      );
    } catch {
      try {
        await get().reload();
      } catch {
        /* reload already set status:"error" */
      }
    }
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
    const prev = get().tasks;
    const next = promoteToMonthOp(prev, id, month);
    if (next === prev) return;
    set({ tasks: next, error: null });
    const updated = next.find((t) => t.id === id)!;
    try {
      await enqueuePatch(id, { scheduled_months: updated.custom_fields.scheduled_months });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async planScheduleDay(id, date) {
    const prev = get().tasks;
    const next = planScheduleDayOp(prev, id, date);
    if (next === prev) return;
    set({ tasks: next, error: null });
    const updated = next.find((t) => t.id === id)!;
    try {
      await enqueuePatch(id, {
        scheduled_dates: updated.custom_fields.scheduled_dates,
        scheduled_months: updated.custom_fields.scheduled_months,
      });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async moveToToday(id) {
    const prev = get().tasks;
    const next = moveToTodayOp(prev, id, get().today);
    if (next === prev) return;
    set({ tasks: next, error: null });
    const updated = next.find((t) => t.id === id)!;
    try {
      await enqueuePatch(id, {
        scheduled_dates: updated.custom_fields.scheduled_dates,
        daily_ranks: updated.custom_fields.daily_ranks ?? [],
        daily_priority: null,
      });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async demoteToMonth(id) {
    const prev = get().tasks;
    const month = currentMonthISO(new Date(get().today + "T00:00:00"));
    const next = demoteToMonthOp(prev, id, month);
    if (next === prev) return;
    set({ tasks: next, error: null });
    const updated = next.find((t) => t.id === id)!;
    try {
      await enqueuePatch(id, {
        unscheduled_at: updated.custom_fields.unscheduled_at,
        scheduled_months: updated.custom_fields.scheduled_months,
        daily_ranks: updated.custom_fields.daily_ranks ?? [],
        daily_priority: null,
      });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async moveToNextMonth(id) {
    const prev = get().tasks;
    const next = moveToNextMonthOp(prev, id);
    if (next === prev) return;
    set({ tasks: next, error: null });
    const updated = next.find((t) => t.id === id)!;
    try {
      await enqueuePatch(id, {
        scheduled_months: updated.custom_fields.scheduled_months,
        monthly_priority: null,
      });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async demoteToBacklog(id) {
    const prev = get().tasks;
    const next = demoteToBacklogOp(prev, id, get().today);
    if (next === prev) return;
    set({ tasks: next, error: null });
    const updated = next.find((t) => t.id === id)!;
    try {
      await enqueuePatch(id, {
        unscheduled_month: updated.custom_fields.unscheduled_month,
        unscheduled_at: updated.custom_fields.unscheduled_at,
        monthly_priority: null,
        daily_priority: null,
      });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async reorderPriority(id, targetRank, axis, scope) {
    const prev = get().tasks;
    const next = reorderPriorityOp(prev, id, targetRank, axis, scope);
    if (next === prev) return;
    set({ tasks: next, error: null });
    const ranksField = axis === "daily" ? "daily_ranks" : "monthly_ranks";
    const legacyField = axis === "daily" ? "daily_priority" : "monthly_priority";
    const changed = next.filter((t) => {
      const before = prev.find((p) => p.id === t.id);
      if (!before) return false;
      return (
        JSON.stringify(before.custom_fields[ranksField] ?? []) !==
          JSON.stringify(t.custom_fields[ranksField] ?? []) ||
        before.custom_fields.position !== t.custom_fields.position
      );
    });
    try {
      await Promise.all(
        changed.map((t) =>
          enqueuePatch(t.id, {
            [ranksField]: t.custom_fields[ranksField] ?? [],
            [legacyField]: null,
            ...(t.custom_fields.position !== prev.find((p) => p.id === t.id)?.custom_fields.position
              ? { position: t.custom_fields.position ?? null }
              : {}),
          }),
        ),
      );
    } catch {
      try {
        await get().reload();
      } catch {
        /* reload already set status:"error" */
      }
    }
  },

  async reorderInPool(id, prevId, nextId) {
    const prev = get().tasks;
    const next = reorderInPoolOp(prev, id, prevId, nextId);
    if (next === prev) return;
    set({ tasks: next, error: null });
    const updated = next.find((t) => t.id === id)!;
    try {
      await enqueuePatch(id, { position: updated.custom_fields.position });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
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
}));
