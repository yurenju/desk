import type { Task, TrailKind } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import styles from "./TaskRow.module.css";

export interface TaskRowProps {
  task: Task;
  kind: TrailKind;
  showAdhocChip?: boolean;
}

export function TaskRow({ task, kind, showAdhocChip }: TaskRowProps) {
  const isDone = task.status === "done";
  const isAdhoc = task.custom_fields.is_adhoc === "true";

  return (
    <div
      className={[styles.row, styles[`k_${kind}`], isDone && styles.done].filter(Boolean).join(" ")}
    >
      <Checkbox checked={isDone} disabled />
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{task.title}</span>
          {kind === "forwarded" && <span className={styles.trail}>↪ 已順延</span>}
          {kind === "dismissed" && <span className={styles.trail}>· 已略過</span>}
        </div>
        {task.description && <div className={styles.desc}>{task.description}</div>}
      </div>
      {showAdhocChip && isAdhoc && <UnplannedChip />}
    </div>
  );
}
