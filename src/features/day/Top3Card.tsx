import type { Task } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import { Menu } from "@/ui/Menu";
import { useSortableRow } from "@/features/plan-view/useSortableRow";
import { TaskDetailTrigger } from "@/features/task-detail/TaskDetailTrigger";
import { useTaskRow } from "./useTaskRow";
import { DailyPriorityMenu } from "./DailyPriorityMenu";
import { buildTaskRowMenuItems } from "./taskRowMenu";
import { isDayAdhocChip } from "@/lib/tasks";
import { useTasksStore } from "@/store/tasks";
import { SortableSection } from "@/features/plan-view/SortableSection";
import { containerId } from "@/features/plan-view/planDrag";
import { useDragOrdering } from "@/features/plan-view/useDragOrdering";
import styles from "./Top3Card.module.css";

export interface Top3CardProps {
  tasks: Task[];
  title: string;
  date: string;
  variant?: "accent" | "plain";
  interactive?: boolean;
  // Lookup over ALL of the day's primary tasks, so an overflow preview that
  // pulls a task in from "other" can still resolve it. Falls back to `tasks`.
  taskById?: Map<string, Task>;
}

export function Top3Card({
  tasks,
  title,
  date,
  variant = "accent",
  interactive,
  taskById,
}: Top3CardProps) {
  const { previewOrder } = useDragOrdering();
  const cid = containerId({ kind: "top3", date });
  const baseIds = tasks.map((t) => `day:${t.id}`);
  const orderedIds = previewOrder(cid, baseIds);
  const byId = taskById ?? new Map(tasks.map((t) => [`day:${t.id}`, t]));
  const ordered = orderedIds.map((id) => byId.get(id)).filter((t): t is Task => Boolean(t));
  return (
    <div className={[styles.card, styles[`v_${variant}`]].join(" ")}>
      <h3 className={styles.heading}>{title}</h3>
      <SortableSection id={cid} items={orderedIds}>
        <ul className={styles.list}>
          {ordered.map((t, i) => (
            <Top3Item
              key={t.id}
              task={t}
              date={date}
              variant={variant}
              interactive={interactive}
              previewRank={i + 1}
            />
          ))}
        </ul>
      </SortableSection>
    </div>
  );
}

function Top3Item({
  task: t,
  date,
  variant,
  interactive,
  previewRank,
}: {
  task: Task;
  date: string;
  variant: "accent" | "plain";
  interactive?: boolean;
  previewRank: number;
}) {
  const row = useTaskRow(t.id, date);
  const today = useTasksStore((s) => s.today);
  const { ref: dragRef, isDragging, handleProps, style } = useSortableRow(`day:${t.id}`);
  const showAdhocChip = isDayAdhocChip(t, date);
  // Ring number follows the live preview position, so ①②③ reflow during a drag
  // before any data is written.
  const ringValue = String(previewRank) as "1" | "2" | "3";
  const order = ringValue as "1" | "2" | "3" | undefined;

  return (
    <li
      ref={dragRef}
      style={style}
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
        <DailyPriorityMenu value={ringValue} onSelect={row.setPriority} />
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
      {showAdhocChip && <UnplannedChip />}
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
