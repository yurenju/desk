import { useMemo } from "react";
import type { Task } from "@/lib/types";
import { tasksOnDate } from "@/lib/tasks";
import { dayOfMonth, shortWeekday } from "@/lib/date";
import { TaskRow } from "./TaskRow";
import { Top3Card } from "./Top3Card";
import styles from "./DayColumn.module.css";

export interface DayColumnProps {
  allTasks: Task[];
  selectedDate: string;
  variant: "plan-narrow" | "today-hero";
}

export function DayColumn({ allTasks, selectedDate, variant }: DayColumnProps) {
  const entries = useMemo(() => tasksOnDate(allTasks, selectedDate), [allTasks, selectedDate]);

  const primary = entries.filter((e) => e.kind === "primary");

  const top3 = primary
    .filter((e) => e.task.custom_fields.daily_priority)
    .sort(
      (a, b) =>
        Number(a.task.custom_fields.daily_priority) - Number(b.task.custom_fields.daily_priority),
    )
    .map((e) => e.task);

  const otherPlanned = primary
    .filter((e) => !e.task.custom_fields.daily_priority && e.task.custom_fields.is_adhoc !== "true");

  const adhoc = primary.filter((e) => e.task.custom_fields.is_adhoc === "true");

  const trails = entries.filter((e) => e.kind !== "primary");

  const parentTitleById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of allTasks) map[t.id] = t.title;
    return map;
  }, [allTasks]);

  return (
    <div className={[styles.col, styles[`v_${variant}`]].join(" ")}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>
          {shortWeekday(selectedDate).toUpperCase()} · {variant === "today-hero" ? "今天" : ""}
        </div>
        <h2 className={styles.bigDate}>
          {monthShort(selectedDate)} {dayOfMonth(selectedDate)}
        </h2>
      </div>

      {top3.length > 0 && (
        <Top3Card
          tasks={top3}
          title="今天最重要的三件事"
          variant="accent"
          showParentRef
          parentTitleById={parentTitleById}
        />
      )}

      {otherPlanned.length > 0 && (
        <section className={styles.section}>
          <header className={styles.sectionHead}>
            其他計劃內 <span className={styles.count}>{otherPlanned.length}</span>
          </header>
          {otherPlanned.map((e) => (
            <TaskRow key={e.task.id} task={e.task} kind={e.kind} />
          ))}
        </section>
      )}

      {adhoc.length > 0 && (
        <section className={styles.section}>
          <header className={[styles.sectionHead, styles.adhocHead].join(" ")}>
            今天臨時加的 <span className={styles.count}>{adhoc.length}</span>
          </header>
          {adhoc.map((e) => (
            <TaskRow key={e.task.id} task={e.task} kind={e.kind} showAdhocChip />
          ))}
        </section>
      )}

      {trails.length > 0 && (
        <section className={styles.section}>
          {trails.map((e) => (
            <TaskRow key={e.task.id} task={e.task} kind={e.kind} />
          ))}
        </section>
      )}
    </div>
  );
}

function monthShort(iso: string): string {
  const [, m] = iso.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[m - 1];
}
