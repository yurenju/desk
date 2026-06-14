import type { Task, TrailKind } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import { Menu } from "@/ui/Menu";
import { PriorityRing } from "@/ui/PriorityRing";
import { useDraggableRow } from "@/features/plan-view/useDraggableRow";
import { TaskDetailTrigger } from "@/features/task-detail/TaskDetailTrigger";
import { useMonthRow } from "./useMonthRow";
import { buildMonthRowMenuItems } from "./monthRowMenu";
import styles from "./MonthRow.module.css";

export interface MonthRowProps {
  task: Task;
  kind: TrailKind;
  month: string;
  selectedDate: string;
  interactive?: boolean;
  showRing?: boolean;
}

export function MonthRow({
  task,
  kind,
  month,
  selectedDate,
  interactive,
  showRing,
}: MonthRowProps) {
  const isDone = task.status === "done";
  const isAdhoc = task.custom_fields.is_adhoc === "true";
  const row = useMonthRow(task.id, { month, selectedDate });
  const editable = Boolean(interactive) && kind === "primary";
  const { ref: dragRef, isDragging, handleProps } = useDraggableRow(`month:${task.id}`);
  const draggable = kind === "primary";

  return (
    <div
      ref={draggable ? dragRef : undefined}
      className={[styles.row, isDone && styles.done, draggable && isDragging && styles.dragging]
        .filter(Boolean)
        .join(" ")}
      {...(draggable ? handleProps : {})}
    >
      <Checkbox
        checked={isDone}
        disabled={!editable}
        onCheckedChange={editable ? row.toggle : undefined}
        aria-label={task.title}
      />
      {showRing && editable && (
        <Menu
          ariaLabel="本月重點"
          selectedKey={task.custom_fields.monthly_priority ?? "none"}
          trigger={
            <PriorityRing
              value={task.custom_fields.monthly_priority ?? null}
              aria-label={
                task.custom_fields.monthly_priority
                  ? `本月重點第 ${task.custom_fields.monthly_priority}`
                  : "設為本月重點"
              }
            />
          }
          items={[
            { key: "1", label: "① 本月第一", onSelect: () => row.setPriority("1") },
            { key: "2", label: "② 本月第二", onSelect: () => row.setPriority("2") },
            { key: "3", label: "③ 本月第三", onSelect: () => row.setPriority("3") },
            { key: "none", label: "— 移除重點", onSelect: () => row.setPriority(null) },
          ]}
        />
      )}
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
        <span className={styles.title}>{task.title}</span>
      )}
      {kind === "forwarded" && <span className={styles.trail}>↪</span>}
      {kind === "dismissed" && <span className={styles.trail}>·略過</span>}
      {isAdhoc && <UnplannedChip />}
      {!row.isEditing && <TaskDetailTrigger task={task} />}
      {editable && !row.isEditing && (
        <div className={styles.actions}>
          <Menu
            ariaLabel="更多動作"
            trigger={
              <button type="button" className={styles.iconBtn} aria-label="更多動作">
                ⋯
              </button>
            }
            items={buildMonthRowMenuItems({ task, selectedDate, row })}
          />
        </div>
      )}
    </div>
  );
}
