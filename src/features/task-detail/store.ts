import { create } from "zustand";

interface TaskDetailState {
  openId: string | null;
  open: (id: string) => void;
  close: () => void;
}

export const useTaskDetailStore = create<TaskDetailState>()((set) => ({
  openId: null,
  open: (id) => set({ openId: id }),
  close: () => set({ openId: null }),
}));
