import type { Task } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { PlannedRefChip } from "@/ui/Chip";
import { PriorityRing } from "@/ui/PriorityRing";
import { useTaskRow } from "./useTaskRow";
import styles from "./Top3Card.module.css";

export interface Top3CardProps {
  tasks: Task[];
  title: string;
  variant?: "accent" | "plain";
  showParentRef?: boolean;
  parentTitleById?: Record<string, string>;
  interactive?: boolean;
}

export function Top3Card({
  tasks,
  title,
  variant = "accent",
  showParentRef,
  parentTitleById,
  interactive,
}: Top3CardProps) {
  return (
    <div className={[styles.card, styles[`v_${variant}`]].join(" ")}>
      <h3 className={styles.heading}>{title}</h3>
      <ul className={styles.list}>
        {tasks.map((t) => (
          <Top3Item
            key={t.id}
            task={t}
            variant={variant}
            showParentRef={showParentRef}
            parentTitleById={parentTitleById}
            interactive={interactive}
          />
        ))}
      </ul>
    </div>
  );
}

function Top3Item({
  task: t,
  variant,
  showParentRef,
  parentTitleById,
  interactive,
}: {
  task: Task;
  variant: "accent" | "plain";
  showParentRef?: boolean;
  parentTitleById?: Record<string, string>;
  interactive?: boolean;
}) {
  const row = useTaskRow(t.id);
  const order = (t.custom_fields.daily_priority ?? t.custom_fields.monthly_priority) as
    | "1"
    | "2"
    | "3"
    | undefined;
  const parentTitle =
    showParentRef && t.parent_id && parentTitleById ? parentTitleById[t.parent_id] : null;

  return (
    <li className={styles.item}>
      <Checkbox
        variant={variant === "accent" ? "accent" : "primary"}
        checked={t.status === "done"}
        disabled={!interactive}
        onCheckedChange={interactive ? row.toggle : undefined}
        aria-label={t.title}
      />
      {interactive ? (
        <PriorityRing value={t.custom_fields.daily_priority ?? null} onClick={row.cyclePriority} />
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
        {parentTitle && (
          <div className={styles.parentRef}>
            <PlannedRefChip order={order ?? "1"} />
            <span className={styles.parentRefText}>{parentTitle}</span>
          </div>
        )}
      </div>
      {interactive && !row.isEditing && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="編輯"
            onClick={() => row.startEdit(t.title)}
          >
            ✎
          </button>
          <button
            type="button"
            className={[styles.iconBtn, styles.del].join(" ")}
            aria-label="刪除"
            onClick={row.remove}
          >
            🗑
          </button>
        </div>
      )}
    </li>
  );
}
