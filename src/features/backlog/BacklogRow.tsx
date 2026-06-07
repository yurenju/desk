import type { Task } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { Menu } from "@/ui/Menu";
import { useDraggableRow } from "@/features/plan-view/useDraggableRow";
import { useBacklogRow } from "./useBacklogRow";
import styles from "./BacklogRow.module.css";

export interface BacklogRowProps {
  task: Task;
  focusDate: string;
}

export function BacklogRow({ task, focusDate }: BacklogRowProps) {
  const isDone = task.status === "done";
  const row = useBacklogRow(task.id, { focusDate });
  const drag = useDraggableRow(task.id);
  const day = focusDate.slice(8);

  return (
    <div
      ref={drag.ref}
      className={[styles.row, isDone && styles.done, drag.isDragging && styles.dragging]
        .filter(Boolean)
        .join(" ")}
      {...drag.handleProps}
    >
      <Checkbox
        checked={isDone}
        disabled={false}
        onCheckedChange={row.toggle}
        aria-label={task.title}
      />
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
      {!row.isEditing && (
        <div className={styles.actions}>
          <Menu
            ariaLabel="更多動作"
            trigger={
              <button type="button" className={styles.iconBtn} aria-label="更多動作">⋯</button>
            }
            items={[
              { key: "to-month", label: "→ 本月（其他計劃內）", onSelect: row.toMonth },
              { key: "to-day-1", label: `→ ${day} 日 · ① 三件事`, onSelect: () => row.toDay("1") },
              { key: "to-day-2", label: `→ ${day} 日 · ② 三件事`, onSelect: () => row.toDay("2") },
              { key: "to-day-3", label: `→ ${day} 日 · ③ 三件事`, onSelect: () => row.toDay("3") },
              { key: "to-day-other", label: `→ ${day} 日 · 其他`, onSelect: () => row.toDay() },
              { key: "edit", label: "編輯", onSelect: () => row.startEdit(task.title) },
              { key: "delete", label: "刪除", onSelect: row.remove, danger: true },
            ]}
          />
        </div>
      )}
    </div>
  );
}
