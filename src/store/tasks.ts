import { create } from "zustand";
import type { Priority, Task } from "@/lib/types";
import { fetchTodos, postTodo } from "@/lib/api/todo";
import { enqueuePatch } from "@/lib/api/todoQueue";
import {
  addTodayTask,
  addMonthTask as addMonthTaskOp,
  addBacklogTask as addBacklogTaskOp,
  promoteToMonth as promoteToMonthOp,
  planScheduleDay as planScheduleDayOp,
  deleteTask,
  editTitle,
  promoteToDay as promoteToDayOp,
  restoreTask as restoreTaskOp,
  setAdhoc as setAdhocOp,
  setDailyPriority,
  setMonthlyPriority as setMonthlyPriorityOp,
  toggleDone,
} from "./taskOps";
import type { RemovedTask } from "./taskOps";
import { todayISO } from "@/lib/date";

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
  addTodayTask: (title: string, date: string) => Promise<void>;
  editTitle: (id: string, title: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  restoreTask: () => Promise<void>;
  setDailyPriority: (id: string, n: Priority | null, date: string) => Promise<void>;
  setAdhoc: (id: string, isAdhoc: boolean) => Promise<void>;
  promoteToDay: (id: string, date: string) => Promise<void>;
  setMonthlyPriority: (id: string, n: Priority | null, month: string) => Promise<void>;
  addMonthTask: (title: string, month: string) => Promise<void>;
  addBacklogTask: (title: string) => Promise<void>;
  promoteToMonth: (id: string, month: string) => Promise<void>;
  planScheduleDay: (id: string, date: string) => Promise<void>;
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

  async addTodayTask(title, date) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const prev = get().tasks;
    const tempId = `temp-${crypto.randomUUID()}`;
    set({ tasks: addTodayTask(prev, trimmed, date, tempId, now()), error: null });
    try {
      const created = await postTodo({
        title: trimmed,
        scheduled_dates: [date],
        is_adhoc: "true",
      });
      set({ tasks: get().tasks.map((t) => (t.id === tempId ? created : t)) });
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
      return before && before.custom_fields.daily_priority !== t.custom_fields.daily_priority;
    });
    try {
      await Promise.all(
        changed.map((t) =>
          enqueuePatch(t.id, { daily_priority: t.custom_fields.daily_priority ?? null }),
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

  async promoteToDay(id, date) {
    const prev = get().tasks;
    const next = promoteToDayOp(prev, id, date);
    if (next === prev) return;
    set({ tasks: next, error: null });
    const updated = next.find((t) => t.id === id);
    try {
      await enqueuePatch(id, { scheduled_dates: updated!.custom_fields.scheduled_dates });
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
      return before && before.custom_fields.monthly_priority !== t.custom_fields.monthly_priority;
    });
    try {
      await Promise.all(
        changed.map((t) =>
          enqueuePatch(t.id, { monthly_priority: t.custom_fields.monthly_priority ?? null }),
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

  async addMonthTask(title, month) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const prev = get().tasks;
    const tempId = `temp-${crypto.randomUUID()}`;
    set({ tasks: addMonthTaskOp(prev, trimmed, month, tempId, now()), error: null });
    try {
      const created = await postTodo({
        title: trimmed,
        scheduled_months: [month],
        is_adhoc: "false",
      });
      set({ tasks: get().tasks.map((t) => (t.id === tempId ? created : t)) });
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
    try {
      const created = await postTodo({ title: trimmed, is_adhoc: "false" });
      set({ tasks: get().tasks.map((t) => (t.id === tempId ? created : t)) });
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
