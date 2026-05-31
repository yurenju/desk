import { create } from "zustand";
import type { Priority, Task } from "@/lib/types";
import { fetchTodos, postTodo, patchTodoApi } from "@/lib/api/todo";
import {
  addTodayTask,
  deleteTask,
  editTitle,
  restoreTask as restoreTaskOp,
  setDailyPriority,
  toggleDone,
} from "./taskOps";
import type { RemovedTask } from "./taskOps";

const now = () => new Date().toISOString();
const todayISO = () => new Date().toISOString().slice(0, 10);

// Monotonic counter used to sequence loadTasks calls. Only the most-recent
// invocation is allowed to commit its result to the store.
let loadSeq = 0;

interface TasksState {
  tasks: Task[];
  today: string;
  status: "loading" | "ready" | "error";
  error: string | null;
  recentlyDeleted: RemovedTask | null;
  loadTasks: (date: string) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  addTodayTask: (title: string) => Promise<void>;
  editTitle: (id: string, title: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  restoreTask: () => Promise<void>;
  setDailyPriority: (id: string, n: Priority | null) => Promise<void>;
  clearTasks: () => void;
  clearRecentlyDeleted: () => void;
  clearError: () => void;
}

export const useTasksStore = create<TasksState>()((set, get) => ({
  tasks: [],
  today: todayISO(),
  status: "loading",
  error: null,
  recentlyDeleted: null,

  async loadTasks(date) {
    const seq = ++loadSeq;
    set({ status: "loading", error: null });
    try {
      const tasks = await fetchTodos(date);
      if (seq !== loadSeq) return;          // a newer load superseded this one
      set({ tasks, today: date, status: "ready" });
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
      await patchTodoApi(id, {
        status: willBeDone ? "done" : "open",
        done_on: willBeDone ? stamp : null,
      });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async addTodayTask(title) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const prev = get().tasks;
    const today = get().today;            // capture once, before any await
    const tempId = `temp-${crypto.randomUUID()}`;
    set({ tasks: addTodayTask(prev, trimmed, today, tempId, now()), error: null });
    try {
      const created = await postTodo(trimmed, today);   // use captured value
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
      await patchTodoApi(id, { title: trimmed });
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
      await patchTodoApi(id, { status: "cancelled" });
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
      await patchTodoApi(removed.task.id, { status: removed.task.status });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async setDailyPriority(id, n) {
    const prev = get().tasks;
    const next = setDailyPriority(prev, id, n, get().today);
    set({ tasks: next, error: null });
    const changed = next.filter((t) => {
      const before = prev.find((p) => p.id === t.id);
      return before && before.custom_fields.daily_priority !== t.custom_fields.daily_priority;
    });
    try {
      await Promise.all(
        changed.map((t) =>
          patchTodoApi(t.id, { daily_priority: t.custom_fields.daily_priority ?? null }),
        ),
      );
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  clearTasks() {
    set({ tasks: [], error: null, recentlyDeleted: null });
  },

  clearRecentlyDeleted() {
    set({ recentlyDeleted: null });
  },

  clearError() {
    set({ error: null });
  },
}));
