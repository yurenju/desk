import type { Task, TaskWithTrail } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import { Menu } from "@/ui/Menu";
import { useSortableRow } from "@/features/plan-view/useSortableRow";
import { TaskDetailTrigger } from "@/features/task-detail/TaskDetailTrigger";
import { useTaskRow } from "./useTaskRow";
import { DailyPriorityMenu } from "./DailyPriorityMenu";
import { buildTaskRowMenuItems } from "./taskRowMenu";
import { isDayAdhocChip, trailLabel } from "@/lib/tasks";
import { useTasksStore } from "@/store/tasks";
import { SortableSection } from "@/features/plan-view/SortableSection";
import { containerId } from "@/features/plan-view/planDrag";
import { useDragOrdering } from "@/features/plan-view/useDragOrdering";
import styles from "./Top3Card.module.css";

export interface Top3CardProps {
  // Primary picks AND moved-out (trail) rows that still hold a daily_priority —
  // the trail rows render greyed, in place, with a "moved to where" label.
  entries: TaskWithTrail[];
  title: string;
  date: string;
  variant?: "accent" | "plain";
  interactive?: boolean;
  // Lookup over ALL of the day's entries, so an overflow preview that pulls a
  // task in from "other" can still resolve it. Falls back to `entries`.
  entryById?: Map<string, TaskWithTrail>;
}

export function Top3Card({
  entries,
  title,
  date,
  variant = "accent",
  interactive,
  entryById,
}: Top3CardProps) {
  const { previewOrder } = useDragOrdering();
  const cid = containerId({ kind: "top3", date });
  const baseIds = entries.map((e) => `day:${e.task.id}`);
  const orderedIds = previewOrder(cid, baseIds);
  const byId = entryById ?? new Map(entries.map((e) => [`day:${e.task.id}`, e]));
  const ordered = orderedIds
    .map((id) => byId.get(id))
    .filter((e): e is TaskWithTrail => Boolean(e));
  // Only primary rows are draggable / sortable; trail rows sit in place as plain
  // list items (matches buildDayContainers, which registers only primary ids).
  const sortableIds = ordered
    .filter((e) => e.kind === "primary")
    .map((e) => `day:${e.task.id}`);
  return (
    <div className={[styles.card, styles[`v_${variant}`]].join(" ")}>
      <h3 className={styles.heading}>{title}</h3>
      <SortableSection id={cid} items={sortableIds}>
        <ul className={styles.list}>
          {ordered.map((e, i) => (
            <Top3Item
              key={e.task.id}
              task={e.task}
              kind={e.kind}
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
  kind,
  date,
  variant,
  interactive,
  previewRank,
}: {
  task: Task;
  kind: TaskWithTrail["kind"];
  date: string;
  variant: "accent" | "plain";
  interactive?: boolean;
  previewRank: number;
}) {
  const row = useTaskRow(t.id, date);
  const today = useTasksStore((s) => s.today);
  const { ref: dragRef, isDragging, handleProps, style } = useSortableRow(`day:${t.id}`);
  const showAdhocChip = isDayAdhocChip(t, date);
  const isTrail = kind !== "primary";
  // Ring number follows the live preview position, so ①②③ reflow during a drag
  // before any data is written.
  const ringValue = String(previewRank) as "1" | "2" | "3";
  const order = ringValue as "1" | "2" | "3" | undefined;

  // Trail rows: greyed, in place, checkable, no drag handle, no overflow menu,
  // no priority menu. They carry a "moved to where" label instead.
  if (isTrail) {
    return (
      <li className={[styles.item, styles.trail].join(" ")}>
        <Checkbox
          variant={variant === "accent" ? "accent" : "primary"}
          checked={t.status === "done"}
          disabled={!interactive}
          onCheckedChange={interactive ? row.toggle : undefined}
          aria-label={t.title}
        />
        {order && <span className={[styles.ring, styles.ringMuted].join(" ")}>{order}</span>}
        <div className={styles.itemBody}>
          <div className={styles.itemTitle}>{t.title}</div>
        </div>
        <span className={styles.trailLabel}>{trailLabel(t, kind, today)}</span>
        <TaskDetailTrigger task={t} />
      </li>
    );
  }

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
