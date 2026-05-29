import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Priority, Task } from "@/lib/types";
import { allTasks, MOCK_TODAY } from "@/mock/data";
import {
  addTodayTask,
  assignNextPriority,
  deleteTask,
  editTitle,
  restoreTask,
  setDailyPriority,
  toggleDone,
  type RemovedTask,
} from "./taskOps";

interface TasksState {
  tasks: Task[];
  today: string;
  recentlyDeleted: RemovedTask | null;
  toggleDone: (id: string) => void;
  addTodayTask: (title: string) => void;
  editTitle: (id: string, title: string) => void;
  deleteTask: (id: string) => void;
  restoreTask: () => void;
  clearRecentlyDeleted: () => void;
  setDailyPriority: (id: string, n: Priority | null) => void;
  promoteToPriority: (id: string) => void;
}

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: allTasks,
      today: MOCK_TODAY,
      recentlyDeleted: null,
      toggleDone: (id) => set({ tasks: toggleDone(get().tasks, id, now()) }),
      addTodayTask: (title) =>
        set({ tasks: addTodayTask(get().tasks, title, get().today, newId(), now()) }),
      editTitle: (id, title) => set({ tasks: editTitle(get().tasks, id, title, now()) }),
      deleteTask: (id) => {
        const { tasks, removed } = deleteTask(get().tasks, id);
        set({ tasks, recentlyDeleted: removed });
      },
      restoreTask: () => {
        const removed = get().recentlyDeleted;
        if (!removed) return;
        set({ tasks: restoreTask(get().tasks, removed), recentlyDeleted: null });
      },
      clearRecentlyDeleted: () => set({ recentlyDeleted: null }),
      setDailyPriority: (id, n) =>
        set({ tasks: setDailyPriority(get().tasks, id, n, get().today) }),
      promoteToPriority: (id) =>
        set({ tasks: assignNextPriority(get().tasks, id, get().today) }),
    }),
    {
      name: "desk.tasks",
      partialize: (s) => ({ tasks: s.tasks, today: s.today }),
    },
  ),
);
