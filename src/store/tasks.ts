import { create } from "zustand";
import type { Priority, Task } from "@/lib/types";
import { fetchTodos, postTodo, patchTodoApi } from "@/lib/api/todo";
import {
  addTodayTask,
  deleteTask,
  editTitle,
  setDailyPriority,
  toggleDone,
} from "./taskOps";

const now = () => new Date().toISOString();
const todayISO = () => new Date().toISOString().slice(0, 10);

interface TasksState {
  tasks: Task[];
  today: string;
  status: "loading" | "ready" | "error";
  error: string | null;
  loadTasks: (date: string) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  addTodayTask: (title: string) => Promise<void>;
  editTitle: (id: string, title: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  setDailyPriority: (id: string, n: Priority | null) => Promise<void>;
  clearTasks: () => void;
}

export const useTasksStore = create<TasksState>()((set, get) => ({
  tasks: [],
  today: todayISO(),
  status: "loading",
  error: null,

  async loadTasks(date) {
    set({ status: "loading", error: null });
    try {
      const tasks = await fetchTodos(date);
      set({ tasks, today: date, status: "ready" });
    } catch {
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
    const tempId = `temp-${crypto.randomUUID()}`;
    set({ tasks: addTodayTask(prev, trimmed, get().today, tempId, now()), error: null });
    try {
      const created = await postTodo(trimmed, get().today);
      set({ tasks: get().tasks.map((t) => (t.id === tempId ? created : t)) });
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async editTitle(id, title) {
    const prev = get().tasks;
    set({ tasks: editTitle(prev, id, title, now()), error: null });
    try {
      // title is a WSPC core field; PATCH-ing the title is out of scope for 2b.
      // Keep the optimistic local update + rollback skeleton only.
      await patchTodoApi(id, {});
    } catch {
      set({ tasks: prev, error: "save_failed" });
    }
  },

  async deleteTask(id) {
    const prev = get().tasks;
    const { tasks } = deleteTask(prev, id);
    set({ tasks, error: null });
    try {
      await patchTodoApi(id, { status: "cancelled" });
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
    set({ tasks: [], error: null });
  },
}));
