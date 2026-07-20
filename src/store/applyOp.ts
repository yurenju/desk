import type { Task } from "@/lib/types";
import type { TodoPatch } from "@/lib/api/todo";

// Top-level Task fields that map straight onto the wire patch. Everything else
// persisted lives in custom_fields.
const TOP_LEVEL = ["status", "title", "description"] as const;

function eq(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

/**
 * The minimal wire patch that turns `prev` into `next` for the fields the server
 * persists. This is the single home for "which fields to PATCH" — ops describe
 * state changes, this derives what to send.
 *
 * Invariant: a custom field present in `prev` but removed in `next` is sent as
 * `null` (clear), never omitted — omitting would leave the server's stale value
 * in place. Field-identical pairs yield an empty patch (caller skips the write).
 */
export function deriveTodoPatch(prev: Task, next: Task): TodoPatch {
  const patch: Record<string, unknown> = {};

  for (const key of TOP_LEVEL) {
    if (!eq(prev[key], next[key])) patch[key] = next[key];
  }

  const keys = new Set<string>([
    ...Object.keys(prev.custom_fields),
    ...Object.keys(next.custom_fields),
  ]);
  for (const key of keys) {
    const before = (prev.custom_fields as Record<string, unknown>)[key];
    const after = (next.custom_fields as Record<string, unknown>)[key];
    if (eq(before, after)) continue;
    patch[key] = after === undefined ? null : after;
  }

  // NOTE: the cast is where static safety is spent — TodoPatch no longer
  // constrains the output shape. A removed array field emits `null` (which the
  // route treats as falsy and drops), and any custom_fields key is forwarded
  // as-is. Correctness rests on the tests below, not the type.
  return patch as TodoPatch;
}
