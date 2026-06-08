export type DropTarget =
  | { kind: "month" }
  | { kind: "day"; date: string; zone: "top3" | "other" };

export function dropId(t: DropTarget): string {
  if (t.kind === "month") return "drop:month";
  return `drop:day:${t.date}:${t.zone}`;
}

export function parseDropId(id: string): DropTarget | null {
  if (id === "drop:month") return { kind: "month" };
  const m = /^drop:day:(\d{4}-\d{2}-\d{2}):(top3|other)$/.exec(id);
  if (!m) return null;
  return { kind: "day", date: m[1], zone: m[2] as "top3" | "other" };
}
