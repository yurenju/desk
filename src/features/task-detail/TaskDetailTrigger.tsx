import type { Task } from "@/lib/types";
import { useTaskDetailStore } from "./store";
import { subtaskGlyph } from "./subtaskGlyph";
import styles from "./TaskDetailTrigger.module.css";

export interface TaskDetailTriggerProps {
  task: Task;
}

export function TaskDetailTrigger({ task }: TaskDetailTriggerProps) {
  const open = useTaskDetailStore((s) => s.open);
  const count = task.subtask_count ?? 0;
  // undefined = the server didn't count done children (subrequest budget);
  // show just the total rather than a misleading 0/N.
  const done = task.subtask_done;
  const hasDesc = Boolean(task.description);

  return (
    <span className={styles.wrap}>
      {(count > 0 || hasDesc) && (
        <span className={styles.badge}>
          {count > 0 && (
            <span
              data-testid="subtask-badge"
              className={styles.count}
              aria-label={
                done === undefined ? `${count} 個子任務` : `${done}/${count} 個子任務完成`
              }
            >
              <span aria-hidden="true">{subtaskGlyph(done ?? 0, count)}</span>
              <span>{done === undefined ? count : `${done}/${count}`}</span>
            </span>
          )}
          {hasDesc && (
            <span className={styles.descDot} aria-label="有描述">
              ·有描述
            </span>
          )}
        </span>
      )}
      <button
        type="button"
        className={styles.expand}
        aria-label="開啟詳情"
        onClick={() => open(task.id)}
      >
        ⤢
      </button>
    </span>
  );
}
