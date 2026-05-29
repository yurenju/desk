import type { Task, TrailKind } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import { PriorityRing } from "@/ui/PriorityRing";
import { useTaskRow } from "./useTaskRow";
import styles from "./TaskRow.module.css";

export interface TaskRowProps {
  task: Task;
  kind: TrailKind;
  showAdhocChip?: boolean;
  interactive?: boolean;
  showRing?: boolean;
}

export function TaskRow({ task, kind, showAdhocChip, interactive, showRing }: TaskRowProps) {
  const isDone = task.status === "done";
  const isAdhoc = task.custom_fields.is_adhoc === "true";
  const row = useTaskRow(task.id);
  const editable = Boolean(interactive) && kind === "primary";

  return (
    <div
      className={[styles.row, styles[`k_${kind}`], isDone && styles.done].filter(Boolean).join(" ")}
    >
      <Checkbox
        checked={isDone}
        disabled={!editable}
        onCheckedChange={editable ? row.toggle : undefined}
        aria-label={task.title}
      />
      {showRing && editable && (
        <PriorityRing
          value={task.custom_fields.daily_priority ?? null}
          onClick={row.cyclePriority}
        />
      )}
      <div className={styles.body}>
        {row.isEditing ? (
          <input
            className={styles.editInput}
            autoFocus
            value={row.draft}
            onChange={(e) => row.changeDraft(e.target.value)}
            onBlur={row.cancelEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") row.commitEdit();
              if (e.key === "Escape") row.cancelEdit();
            }}
          />
        ) : (
          <div className={styles.titleRow}>
            <span className={styles.title}>{task.title}</span>
            {kind === "forwarded" && <span className={styles.trail}>↪ 已順延</span>}
            {kind === "dismissed" && <span className={styles.trail}>· 已略過</span>}
          </div>
        )}
        {task.description && <div className={styles.desc}>{task.description}</div>}
      </div>
      {showAdhocChip && isAdhoc && <UnplannedChip />}
      {editable && !row.isEditing && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="編輯"
            onClick={() => row.startEdit(task.title)}
          >
            ✎
          </button>
          <button
            type="button"
            className={[styles.iconBtn, styles.del].join(" ")}
            aria-label="刪除"
            onClick={row.remove}
          >
            🗑
          </button>
        </div>
      )}
    </div>
  );
}
