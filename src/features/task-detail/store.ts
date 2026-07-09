import { create } from "zustand";

interface TaskDetailState {
  openId: string | null;
  // Ancestor ids of the open task, oldest first — lets a subtask's modal
  // navigate back to the parent that opened it.
  trail: string[];
  open: (id: string) => void;
  push: (id: string) => void;
  back: () => void;
  close: () => void;
}

export const useTaskDetailStore = create<TaskDetailState>()((set) => ({
  openId: null,
  trail: [],
  open: (id) => set({ openId: id, trail: [] }),
  push: (id) =>
    set((s) => ({ openId: id, trail: s.openId ? [...s.trail, s.openId] : s.trail })),
  back: () =>
    set((s) => {
      const trail = [...s.trail];
      const prev = trail.pop() ?? null;
      return { openId: prev, trail };
    }),
  close: () => set({ openId: null, trail: [] }),
}));
