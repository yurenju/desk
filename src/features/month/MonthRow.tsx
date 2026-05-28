import type { Task, TrailKind } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import styles from "./MonthRow.module.css";

export interface MonthRowProps {
  task: Task;
  kind: TrailKind;
}

export function MonthRow({ task, kind }: MonthRowProps) {
  const isDone = task.status === "done";
  const isAdhoc = task.custom_fields.is_adhoc === "true";

  return (
    <div className={[styles.row, isDone && styles.done].filter(Boolean).join(" ")}>
      <Checkbox checked={isDone} disabled />
      <span className={styles.title}>{task.title}</span>
      {kind === "forwarded" && <span className={styles.trail}>↪</span>}
      {kind === "dismissed" && <span className={styles.trail}>·略過</span>}
      {isAdhoc && <UnplannedChip />}
    </div>
  );
}
