import type { Task, TrailKind } from "@/lib/types";
import { delayKind, monthlyRankOn, monthTrailLabel } from "@/lib/tasks";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import { Menu } from "@/ui/Menu";
import { RowTitleInput } from "@/ui/RowTitleInput";
import type { CSSProperties } from "react";
import { useDraggableRow } from "@/features/plan-view/useDraggableRow";
import { useSortableRow } from "@/features/plan-view/useSortableRow";
import { TaskDetailTrigger } from "@/features/task-detail/TaskDetailTrigger";
import { useMonthRow } from "./useMonthRow";
import { MonthPriorityMenu } from "./MonthPriorityMenu";
import { buildMonthRowMenuItems } from "./monthRowMenu";
import styles from "./MonthRow.module.css";

export interface MonthRowProps {
  task: Task;
  kind: TrailKind;
  month: string;
  selectedDate: string;
  interactive?: boolean;
  showRing?: boolean;
  weekdayLabel?: string;
  otherWeekDate?: string;
}

// dnd binding shared by both row variants: a ref, drag listeners/attributes, a
// transform style (sortable only), and the live isDragging flag.
interface RowDnd {
  ref: (node: HTMLElement | null) => void;
  isDragging: boolean;
  handleProps: Record<string, unknown>;
  style?: CSSProperties;
}

/**
 * 其他任務 pool row: sortable (in-column reorder, registers a SortableContext
 * member with id "month:<id>"). Calls exactly one dnd hook so registration is
 * unambiguous.
 */
export function SortableMonthRow(props: MonthRowProps) {
  const { ref, isDragging, handleProps, style } = useSortableRow(`month:${props.task.id}`);
  return <MonthRowImpl {...props} dnd={{ ref, isDragging, handleProps, style }} />;
}

/**
 * Trail / scheduled / done row: plain cross-column draggable (drops onto week
 * cells / month zone, not a SortableContext member). Also the default `MonthRow`.
 */
export function MonthRow(props: MonthRowProps) {
  const { ref, isDragging, handleProps } = useDraggableRow(`month:${props.task.id}`);
  return <MonthRowImpl {...props} dnd={{ ref, isDragging, handleProps }} />;
}

function MonthRowImpl({
  task,
  kind,
  month,
  selectedDate,
  interactive,
  showRing,
  weekdayLabel,
  otherWeekDate,
  dnd,
}: MonthRowProps & { dnd: RowDnd }) {
  const isDone = task.status === "done";
  const isAdhoc = task.custom_fields.is_adhoc === "true";
  const delay = kind === "primary" && !isDone ? delayKind(task, month) : "none";
  const delayTitle =
    delay === "carried"
      ? "之前的月份就排了，一直拖到現在"
      : delay === "dismissed"
        ? "這個月排到某天卻沒做"
        : undefined;
  const row = useMonthRow(task.id, { month, selectedDate });
  const editable = Boolean(interactive) && kind === "primary";
  // Trail rows (forwarded/dismissed) stay read-only — no ring/menu/edit — but can
  // still be checked complete (same entity), so the checkbox uses `checkable`, not `editable`.
  const checkable = Boolean(interactive);
  const { ref: dragRef, isDragging, handleProps, style } = dnd;
  const draggable = kind === "primary";

  return (
    <div
      ref={draggable ? dragRef : undefined}
      style={draggable ? style : undefined}
      className={[styles.row, isDone && styles.done, draggable && isDragging && styles.dragging]
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
        <MonthPriorityMenu
          value={monthlyRankOn(task, month) ?? null}
          onSelect={row.setPriority}
        />
      )}
      {kind === "primary" && (
        <span
          className={[styles.dot, delay !== "none" && styles[delay]].filter(Boolean).join(" ")}
          title={delayTitle}
          aria-hidden={delay === "none" ? true : undefined}
        />
      )}
      {row.isEditing ? (
        <RowTitleInput
          className={styles.editInput}
          draft={row.draft}
          onChangeDraft={row.changeDraft}
          onCommit={row.commitEdit}
          onCancel={row.cancelEdit}
        />
      ) : (
        <span className={styles.title}>{task.title}</span>
      )}
      {kind !== "primary" && (
        <span className={styles.trail}>{monthTrailLabel(task, kind)}</span>
      )}
      {isAdhoc && <UnplannedChip />}
      {weekdayLabel && <span className={styles.weekChip}>{weekdayLabel}</span>}
      {otherWeekDate && <span className={styles.otherDate}>{otherWeekDate}</span>}
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
