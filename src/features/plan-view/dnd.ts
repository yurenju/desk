export type DropTarget =
  | { kind: "month" }
  | { kind: "day"; date: string; zone: "top3" | "other" }
  // Week cells use a single droppable per day; whether the drop lands in the
  // day's top-3 or other is decided by the drop's vertical position at runtime
  // (see PlanLayout.handleDragEnd). The two tiny stacked sub-zones that a
  // "day" target implies are unreliable to hit inside a cramped week cell.
  | { kind: "weekday"; date: string };

export function dropId(t: DropTarget): string {
  if (t.kind === "month") return "drop:month";
  if (t.kind === "weekday") return `drop:weekday:${t.date}`;
  return `drop:day:${t.date}:${t.zone}`;
}

export function parseDropId(id: string): DropTarget | null {
  if (id === "drop:month") return { kind: "month" };
  const wd = /^drop:weekday:(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (wd) return { kind: "weekday", date: wd[1] };
  const m = /^drop:day:(\d{4}-\d{2}-\d{2}):(top3|other)$/.exec(id);
  if (!m) return null;
  return { kind: "day", date: m[1], zone: m[2] as "top3" | "other" };
}
