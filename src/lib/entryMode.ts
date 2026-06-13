import { useSyncExternalStore } from "react";

export type EntryMode = "planned" | "adhoc";

export const STORAGE_KEY = "desk.entryMode";

function readInitial(): EntryMode {
  if (typeof localStorage === "undefined") return "planned";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "adhoc" || v === "planned" ? v : "planned";
}

let current: EntryMode = readInitial();
const listeners = new Set<() => void>();

export function getEntryMode(): EntryMode {
  return current;
}

export function setEntryMode(mode: EntryMode): void {
  if (mode === current) return;
  current = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage unavailable (private mode / SSR) — keep in-memory only.
  }
  listeners.forEach((l) => l());
}

export function isAdhocOf(mode: EntryMode): boolean {
  return mode === "adhoc";
}

// Exported for tests; not part of the component-facing API.
export function __subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useEntryMode(): [EntryMode, (mode: EntryMode) => void] {
  const mode = useSyncExternalStore(__subscribe, getEntryMode, getEntryMode);
  return [mode, setEntryMode];
}
