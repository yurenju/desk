import type { Task } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { PlannedRefChip } from "@/ui/Chip";
import styles from "./Top3Card.module.css";

export interface Top3CardProps {
  tasks: Task[];
  title: string;
  variant?: "accent" | "plain";
  showParentRef?: boolean;
  parentTitleById?: Record<string, string>;
}

export function Top3Card({
  tasks,
  title,
  variant = "accent",
  showParentRef,
  parentTitleById,
}: Top3CardProps) {
  return (
    <div className={[styles.card, styles[`v_${variant}`]].join(" ")}>
      <h3 className={styles.heading}>{title}</h3>
      <ul className={styles.list}>
        {tasks.map((t) => {
          const order = (t.custom_fields.daily_priority ?? t.custom_fields.monthly_priority) as
            | "1"
            | "2"
            | "3"
            | undefined;
          const parentTitle =
            showParentRef && t.parent_id && parentTitleById ? parentTitleById[t.parent_id] : null;
          return (
            <li key={t.id} className={styles.item}>
              {order && <span className={styles.ring}>{order}</span>}
              <div className={styles.itemBody}>
                <div className={styles.itemTitle}>{t.title}</div>
                {parentTitle && (
                  <div className={styles.parentRef}>
                    <PlannedRefChip order={order ?? "1"} />
                    <span className={styles.parentRefText}>{parentTitle}</span>
                  </div>
                )}
              </div>
              <Checkbox variant="accent" checked={t.status === "done"} disabled />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
