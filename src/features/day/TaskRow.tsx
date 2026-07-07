import type { Task, TrailKind } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { RowTitleInput } from "@/ui/RowTitleInput";
import { UnplannedChip } from "@/ui/Chip";
import { Menu } from "@/ui/Menu";
import { useSortableRow } from "@/features/plan-view/useSortableRow";
import { TaskDetailTrigger } from "@/features/task-detail/TaskDetailTrigger";
import { useTaskRow } from "./useTaskRow";
import { DailyPriorityMenu } from "./DailyPriorityMenu";
import { buildTaskRowMenuItems } from "./taskRowMenu";
import { isDayAdhocChip, trailLabel, dailyRankOn } from "@/lib/tasks";
import { useTasksStore } from "@/store/tasks";
import styles from "./TaskRow.module.css";

export interface TaskRowProps {
  task: Task;
  kind: TrailKind;
  date: string;
  interactive?: boolean;
  showRing?: boolean;
}

export function TaskRow({ task, kind, date, interactive, showRing }: TaskRowProps) {
  const isDone = task.status === "done";
  const showAdhocChip = isDayAdhocChip(task, date);
  const row = useTaskRow(task.id, date);
  const today = useTasksStore((s) => s.today);
  const editable = Boolean(interactive) && kind === "primary";
  // Trail rows (forwarded/dismissed) stay read-only — no ring/menu/edit — but can
  // still be checked complete (same entity), so the checkbox uses `checkable`, not `editable`.
  const checkable = Boolean(interactive);
  const { ref: dragRef, isDragging, handleProps, style } = useSortableRow(`day:${task.id}`);
  const draggable = kind === "primary";

  return (
    <div
      ref={draggable ? dragRef : undefined}
      style={draggable ? style : undefined}
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
          value={dailyRankOn(task, date)}
          onSelect={row.setPriority}
        />
      )}
      <div className={styles.body}>
        {row.isEditing ? (
          <RowTitleInput
            draft={row.draft}
            onChangeDraft={row.changeDraft}
            onCommit={row.commitEdit}
            onCancel={row.cancelEdit}
          />
        ) : (
          <div className={styles.titleRow}>
            <span className={styles.title}>{task.title}</span>
            {task.recurring && (
              <span className={styles.recurring} role="img" aria-label="重複任務" title="重複任務">
                ↻
              </span>
            )}
            {kind !== "primary" && (
              <span className={styles.trail}>{trailLabel(task, kind, today)}</span>
            )}
          </div>
        )}
        {task.description && <div className={styles.desc}>{task.description}</div>}
      </div>
      {showAdhocChip && <UnplannedChip />}
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
