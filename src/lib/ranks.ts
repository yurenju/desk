import type { Priority } from "./types";

function isPriority(s: string): s is Priority {
  return s === "1" || s === "2" || s === "3";
}

/** Parse ["YYYY-MM-DD:R", ...] into Map<key, Priority>; skips malformed entries. */
export function parseRanks(arr: string[] | undefined): Map<string, Priority> {
  const map = new Map<string, Priority>();
  for (const entry of arr ?? []) {
    const i = entry.lastIndexOf(":");
    if (i <= 0) continue;
    const key = entry.slice(0, i);
    const rank = entry.slice(i + 1);
    if (isPriority(rank)) map.set(key, rank);
  }
  return map;
}

/** Encode back to a key-sorted string[] for stable output. */
export function encodeRanks(map: Map<string, Priority>): string[] {
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, r]) => `${k}:${r}`);
}

/** Look up one key's rank (no fallback — see lib/tasks for the bound queries). */
export function rankOn(arr: string[] | undefined, key: string): Priority | null {
  return parseRanks(arr).get(key) ?? null;
}

/**
 * Produce the new ranks array when writing `rank` (or null to clear) for `key`.
 * On first write (array still empty) the legacy single value is folded into
 * `legacy.key` so the task's current-period rank survives the migration.
 */
export function writeRank(
  arr: string[] | undefined,
  key: string,
  rank: Priority | null,
  legacy: { value?: Priority; key: string | null },
): string[] {
  const map = parseRanks(arr);
  if (map.size === 0 && legacy.value && legacy.key) map.set(legacy.key, legacy.value);
  if (rank === null) map.delete(key);
  else map.set(key, rank);
  return encodeRanks(map);
}
