import type { Task } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import { Menu } from "@/ui/Menu";
import { useDraggableRow } from "@/features/plan-view/useDraggableRow";
import { TaskDetailTrigger } from "@/features/task-detail/TaskDetailTrigger";
import { useTaskRow } from "./useTaskRow";
import { DailyPriorityMenu } from "./DailyPriorityMenu";
import { buildTaskRowMenuItems } from "./taskRowMenu";
import { useTasksStore } from "@/store/tasks";
import styles from "./Top3Card.module.css";

export interface Top3CardProps {
  tasks: Task[];
  title: string;
  date: string;
  variant?: "accent" | "plain";
  interactive?: boolean;
}

export function Top3Card({ tasks, title, date, variant = "accent", interactive }: Top3CardProps) {
  return (
    <div className={[styles.card, styles[`v_${variant}`]].join(" ")}>
      <h3 className={styles.heading}>{title}</h3>
      <ul className={styles.list}>
        {tasks.map((t) => (
          <Top3Item key={t.id} task={t} date={date} variant={variant} interactive={interactive} />
        ))}
      </ul>
    </div>
  );
}

function Top3Item({
  task: t,
  date,
  variant,
  interactive,
}: {
  task: Task;
  date: string;
  variant: "accent" | "plain";
  interactive?: boolean;
}) {
  const row = useTaskRow(t.id, date);
  const today = useTasksStore((s) => s.today);
  const { ref: dragRef, isDragging, handleProps } = useDraggableRow(`day:${t.id}`);
  const isAdhoc = t.custom_fields.is_adhoc === "true";
  const order = (t.custom_fields.daily_priority ?? t.custom_fields.monthly_priority) as
    | "1"
    | "2"
    | "3"
    | undefined;

  return (
    <li
      ref={dragRef}
      className={[styles.item, isDragging && styles.dragging].filter(Boolean).join(" ")}
      {...handleProps}
    >
      <Checkbox
        variant={variant === "accent" ? "accent" : "primary"}
        checked={t.status === "done"}
        disabled={!interactive}
        onCheckedChange={interactive ? row.toggle : undefined}
        aria-label={t.title}
      />
      {interactive ? (
        <DailyPriorityMenu value={t.custom_fields.daily_priority ?? null} onSelect={row.setPriority} />
      ) : (
        order && <span className={styles.ring}>{order}</span>
      )}
      <div className={styles.itemBody}>
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
          <div className={styles.itemTitle}>{t.title}</div>
        )}
      </div>
      {isAdhoc && <UnplannedChip />}
      <TaskDetailTrigger task={t} />
      {interactive && !row.isEditing && (
        <div className={styles.actions}>
          <Menu
            ariaLabel="更多動作"
            trigger={
              <button type="button" className={styles.iconBtn} aria-label="更多動作">
                ⋯
              </button>
            }
            items={buildTaskRowMenuItems({ task: t, date, today, row })}
          />
        </div>
      )}
    </li>
  );
}
