import type { Task, TrailKind } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import { Menu } from "@/ui/Menu";
import { useDraggableRow } from "@/features/plan-view/useDraggableRow";
import { TaskDetailTrigger } from "@/features/task-detail/TaskDetailTrigger";
import { useTaskRow } from "./useTaskRow";
import { DailyPriorityMenu } from "./DailyPriorityMenu";
import { buildTaskRowMenuItems } from "./taskRowMenu";
import { useTasksStore } from "@/store/tasks";
import styles from "./TaskRow.module.css";

export interface TaskRowProps {
  task: Task;
  kind: TrailKind;
  date: string;
  showAdhocChip?: boolean;
  interactive?: boolean;
  showRing?: boolean;
}

export function TaskRow({ task, kind, date, showAdhocChip, interactive, showRing }: TaskRowProps) {
  const isDone = task.status === "done";
  const isAdhoc = task.custom_fields.is_adhoc === "true";
  const row = useTaskRow(task.id, date);
  const today = useTasksStore((s) => s.today);
  const editable = Boolean(interactive) && kind === "primary";
  const checkable = Boolean(interactive);
  const { ref: dragRef, isDragging, handleProps } = useDraggableRow(`day:${task.id}`);
  const draggable = kind === "primary";

  return (
    <div
      ref={draggable ? dragRef : undefined}
      className={[
        styles.row,
        styles[`k_${kind}`],
        isDone && styles.done,
        draggable && isDragging && styles.dragging,
      ]
        .filter(Boolean)
        .join(" ")}
      {...(draggable ? handleProps : {})}
    >
      <Checkbox
        checked={isDone}
        disabled={!checkable}
        onCheckedChange={checkable ? row.toggle : undefined}
        aria-label={task.title}
      />
      {showRing && editable && (
        <DailyPriorityMenu
          value={task.custom_fields.daily_priority ?? null}
          onSelect={row.setPriority}
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
              if (e.key === "Enter" && !e.nativeEvent.isComposing) row.commitEdit();
              if (e.key === "Escape") row.cancelEdit();
            }}
          />
        ) : (
          <div className={styles.titleRow}>
            <span className={styles.title}>{task.title}</span>
            {task.recurring && (
              <span className={styles.recurring} role="img" aria-label="重複任務" title="重複任務">
                ↻
              </span>
            )}
            {kind === "forwarded" && <span className={styles.trail}>↪ 已順延</span>}
            {kind === "dismissed" && <span className={styles.trail}>· 退回月度</span>}
          </div>
        )}
        {task.description && <div className={styles.desc}>{task.description}</div>}
      </div>
      {showAdhocChip && isAdhoc && <UnplannedChip />}
      <TaskDetailTrigger task={task} />
      {editable && !row.isEditing && (
        <div className={styles.actions}>
          <Menu
            ariaLabel="更多動作"
            trigger={
              <button type="button" className={styles.iconBtn} aria-label="更多動作">
                ⋯
              </button>
            }
            items={buildTaskRowMenuItems({ task, date, today, row })}
          />
        </div>
      )}
    </div>
  );
}
