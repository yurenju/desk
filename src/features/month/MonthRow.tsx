import type { Task, TrailKind } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import { Menu } from "@/ui/Menu";
import { PriorityRing } from "@/ui/PriorityRing";
import { useDraggableRow } from "@/features/plan-view/useDraggableRow";
import { useMonthRow } from "./useMonthRow";
import styles from "./MonthRow.module.css";

export interface MonthRowProps {
  task: Task;
  kind: TrailKind;
  month: string;
  selectedDate: string;
  interactive?: boolean;
  showRing?: boolean;
}

export function MonthRow({ task, kind, month, selectedDate, interactive, showRing }: MonthRowProps) {
  const isDone = task.status === "done";
  const isAdhoc = task.custom_fields.is_adhoc === "true";
  const row = useMonthRow(task.id, { month, selectedDate });
  const editable = Boolean(interactive) && kind === "primary";
  const drag = useDraggableRow(task.id);
  const draggable = kind === "primary";

  return (
    <div
      ref={draggable ? drag.ref : undefined}
      className={[styles.row, isDone && styles.done, drag.isDragging && styles.dragging]
        .filter(Boolean)
        .join(" ")}
      {...(draggable ? drag.handleProps : {})}
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
              aria-label={task.custom_fields.monthly_priority ? `本月重點第 ${task.custom_fields.monthly_priority}` : "設為本月重點"}
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
      {editable && !row.isEditing && (
        <div className={styles.actions}>
          <Menu
            ariaLabel="更多動作"
            trigger={
              <button type="button" className={styles.iconBtn} aria-label="更多動作">⋯</button>
            }
            items={[
              { key: "promote-1", label: `→ ${selectedDate.slice(8)} 日 · ① 三件事`, onSelect: () => row.promote("1") },
              { key: "promote-2", label: `→ ${selectedDate.slice(8)} 日 · ② 三件事`, onSelect: () => row.promote("2") },
              { key: "promote-3", label: `→ ${selectedDate.slice(8)} 日 · ③ 三件事`, onSelect: () => row.promote("3") },
              { key: "promote-other", label: `→ ${selectedDate.slice(8)} 日 · 其他`, onSelect: () => row.promote() },
              isAdhoc
                ? { key: "to-planned", label: "↑ 移到計畫內", onSelect: row.toggleAdhoc }
                : { key: "to-adhoc", label: "↓ 標為計畫外", onSelect: row.toggleAdhoc },
              { key: "edit", label: "編輯", onSelect: () => row.startEdit(task.title) },
              { key: "delete", label: "刪除", onSelect: row.remove, danger: true },
            ]}
          />
        </div>
      )}
    </div>
  );
}
