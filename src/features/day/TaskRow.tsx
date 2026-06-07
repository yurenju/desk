import type { Task, TrailKind } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import { Menu } from "@/ui/Menu";
import { PriorityRing } from "@/ui/PriorityRing";
import { useTaskRow } from "./useTaskRow";
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
        <Menu
          ariaLabel="今日重點"
          selectedKey={task.custom_fields.daily_priority ?? "none"}
          trigger={<PriorityRing value={task.custom_fields.daily_priority ?? null} />}
          items={[
            { key: "1", label: "① 今日第一", onSelect: () => row.setPriority("1") },
            { key: "2", label: "② 今日第二", onSelect: () => row.setPriority("2") },
            { key: "3", label: "③ 今日第三", onSelect: () => row.setPriority("3") },
            { key: "none", label: "— 移除重點", onSelect: () => row.setPriority(null) },
          ]}
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
            {kind === "forwarded" && <span className={styles.trail}>↪ 已順延</span>}
            {kind === "dismissed" && <span className={styles.trail}>· 已略過</span>}
          </div>
        )}
        {task.description && <div className={styles.desc}>{task.description}</div>}
      </div>
      {showAdhocChip && isAdhoc && <UnplannedChip />}
      {editable && !row.isEditing && (
        <div className={styles.actions}>
          <Menu
            ariaLabel="更多動作"
            trigger={
              <button type="button" className={styles.iconBtn} aria-label="更多動作">
                ⋯
              </button>
            }
            items={[
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
