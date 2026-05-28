import { useCallback, useEffect, useState } from "react";

export type ThemePref = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "desk.theme";

function readPref(): ThemePref {
  if (typeof localStorage === "undefined") return "auto";
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "auto") return v;
  return "auto";
}

function readSystemDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", resolved);
  }
}

export function useTheme(): {
  pref: ThemePref;
  resolved: ResolvedTheme;
  setPref(p: ThemePref): void;
} {
  const [pref, setPrefState] = useState<ThemePref>(() => readPref());
  const [systemDark, setSystemDark] = useState<boolean>(() => readSystemDark());

  // Derived value — no setState needed.
  const resolved: ResolvedTheme = pref === "auto" ? (systemDark ? "dark" : "light") : pref;

  // Sync DOM attribute when resolved theme changes.
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // Subscribe to system color-scheme changes (only relevant for auto mode).
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    localStorage.setItem(STORAGE_KEY, p);
    setPrefState(p);
  }, []);

  return { pref, resolved, setPref };
}
