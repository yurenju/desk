import type { Task } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { RowTitleInput } from "@/ui/RowTitleInput";
import { Menu } from "@/ui/Menu";
import { useSortableRow } from "@/features/plan-view/useSortableRow";
import { TaskDetailTrigger } from "@/features/task-detail/TaskDetailTrigger";
import { useBacklogRow } from "./useBacklogRow";
import { buildBacklogRowMenuItems } from "./backlogRowMenu";
import styles from "./BacklogRow.module.css";

export interface BacklogRowProps {
  task: Task;
  focusDate: string;
}

export function BacklogRow({ task, focusDate }: BacklogRowProps) {
  const isDone = task.status === "done";
  const row = useBacklogRow(task.id, { focusDate });
  const { ref: dragRef, isDragging, handleProps, style } = useSortableRow(`backlog:${task.id}`);

  return (
    <div
      ref={dragRef}
      style={style}
      className={[styles.row, isDone && styles.done, isDragging && styles.dragging]
        .filter(Boolean)
        .join(" ")}
      {...handleProps}
    >
      <Checkbox
        checked={isDone}
        disabled={false}
        onCheckedChange={row.toggle}
        aria-label={task.title}
      />
      {row.isEditing ? (
        <RowTitleInput
          draft={row.draft}
          onChangeDraft={row.changeDraft}
          onCommit={row.commitEdit}
          onCancel={row.cancelEdit}
        />
      ) : (
        <span className={styles.title}>{task.title}</span>
      )}
      {!row.isEditing && <TaskDetailTrigger task={task} />}
      {!row.isEditing && (
        <div className={styles.actions}>
          <Menu
            ariaLabel="更多動作"
            trigger={
              <button type="button" className={styles.iconBtn} aria-label="更多動作">
                ⋯
              </button>
            }
            items={buildBacklogRowMenuItems({ task, focusDate, row })}
          />
        </div>
      )}
    </div>
  );
}
