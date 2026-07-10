import type { Task, TrailKind } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { Menu } from "@/ui/Menu";
import { buildStatusMenuItems, type StatusMenuActions } from "./statusMenu";
import styles from "./StatusCell.module.css";

export interface StatusCellProps {
  task: Task;
  kind: TrailKind;
  row: StatusMenuActions;
  interactive?: boolean;
  checkboxVariant?: "primary" | "accent";
}

/**
 * The leftmost state cell of a day row. Shared by TaskRow and Top3Item so the
 * two never drift.
 *
 * - primary (open) / done → the plain checkbox, one click toggles.
 *   Done wins over trail: a completed forwarded/dismissed task shows the green
 *   check, not an arrow.
 * - forwarded → warm amber box with "→", opens a status menu.
 * - dismissed → cool blue-grey box with "↩", opens a status menu.
 */
export function StatusCell({
  task,
  kind,
  row,
  interactive,
  checkboxVariant = "primary",
}: StatusCellProps) {
  const isDone = task.status === "done";
  if (kind === "primary" || isDone) {
    return (
      <Checkbox
        // Done always shows the green accent check (the third color signal,
        // next to warm forwarded and cool dismissed); unchecked keeps the
        // caller's variant.
        variant={isDone ? "accent" : checkboxVariant}
        checked={isDone}
        disabled={!interactive}
        onCheckedChange={interactive ? row.toggle : undefined}
        aria-label={task.title}
      />
    );
  }
  const trigger = (
    <button
      type="button"
      className={[styles.cell, styles[`k_${kind}`]].join(" ")}
      aria-label={`變更狀態：${task.title}`}
      disabled={!interactive}
    >
      {kind === "forwarded" ? "→" : "↩"}
    </button>
  );
  if (!interactive) return trigger;
  return <Menu ariaLabel="變更狀態" trigger={trigger} items={buildStatusMenuItems({ kind, row })} />;
}
