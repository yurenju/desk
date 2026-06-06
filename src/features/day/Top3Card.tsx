import type { Task } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { Menu } from "@/ui/Menu";
import { PriorityRing } from "@/ui/PriorityRing";
import { useTaskRow } from "./useTaskRow";
import styles from "./Top3Card.module.css";

export interface Top3CardProps {
  tasks: Task[];
  title: string;
  variant?: "accent" | "plain";
  interactive?: boolean;
}

export function Top3Card({ tasks, title, variant = "accent", interactive }: Top3CardProps) {
  return (
    <div className={[styles.card, styles[`v_${variant}`]].join(" ")}>
      <h3 className={styles.heading}>{title}</h3>
      <ul className={styles.list}>
        {tasks.map((t) => (
          <Top3Item key={t.id} task={t} variant={variant} interactive={interactive} />
        ))}
      </ul>
    </div>
  );
}

function Top3Item({
  task: t,
  variant,
  interactive,
}: {
  task: Task;
  variant: "accent" | "plain";
  interactive?: boolean;
}) {
  const row = useTaskRow(t.id);
  const isAdhoc = t.custom_fields.is_adhoc === "true";
  const order = (t.custom_fields.daily_priority ?? t.custom_fields.monthly_priority) as
    | "1"
    | "2"
    | "3"
    | undefined;

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
        <Menu
          ariaLabel="今日重點"
          selectedKey={t.custom_fields.daily_priority ?? "none"}
          trigger={<PriorityRing value={t.custom_fields.daily_priority ?? null} />}
          items={[
            { key: "1", label: "① 今日第一", onSelect: () => row.setPriority("1") },
            { key: "2", label: "② 今日第二", onSelect: () => row.setPriority("2") },
            { key: "3", label: "③ 今日第三", onSelect: () => row.setPriority("3") },
            { key: "none", label: "— 移除重點", onSelect: () => row.setPriority(null) },
          ]}
        />
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
      {interactive && !row.isEditing && (
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
              { key: "edit", label: "編輯", onSelect: () => row.startEdit(t.title) },
              { key: "delete", label: "刪除", onSelect: row.remove, danger: true },
            ]}
          />
        </div>
      )}
    </li>
  );
}
