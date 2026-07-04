import { create } from "zustand";
import { useTasksStore } from "./tasks";

export interface AuthMe {
  userId: string;
  email: string;
  displayName?: string;
}

interface AuthState {
  me: AuthMe | null;
  status: "loading" | "authenticated" | "unauthenticated";
  setMe(me: AuthMe): void;
  clear(): void;
  fetchMe(): Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  me: null,
  status: "loading",
  setMe(me) {
    set({ me, status: "authenticated" });
  },
  clear() {
    useTasksStore.getState().clearTasks();
    useTasksStore.persist.clearStorage();
    set({ me: null, status: "unauthenticated" });
  },
  async fetchMe() {
    const res = await fetch("/api/me", { credentials: "same-origin" });
    if (res.status === 200) {
      const data = (await res.json()) as {
        user_id: string;
        email: string;
        display_name?: string;
      };
      set({
        me: {
          userId: data.user_id,
          email: data.email,
          displayName: data.display_name,
        },
        status: "authenticated",
      });
    } else {
      set({ me: null, status: "unauthenticated" });
    }
  },
}));
