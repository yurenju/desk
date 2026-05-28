import { useMemo } from "react";
import type { Task } from "@/lib/types";
import { tasksOnMonth } from "@/lib/tasks";
import { formatMonth } from "@/lib/date";
import { BacklogSection } from "@/features/backlog/BacklogSection";
import { MonthHeroCard } from "./MonthHeroCard";
import { MonthRow } from "./MonthRow";
import styles from "./MonthColumn.module.css";

export interface MonthColumnProps {
  allTasks: Task[];
  month: string;
}

export function MonthColumn({ allTasks, month }: MonthColumnProps) {
  const entries = useMemo(() => tasksOnMonth(allTasks, month), [allTasks, month]);
  const primary = entries.filter((e) => e.kind === "primary");

  const top3 = primary
    .filter((e) => e.task.custom_fields.monthly_priority)
    .sort(
      (a, b) =>
        Number(a.task.custom_fields.monthly_priority) -
        Number(b.task.custom_fields.monthly_priority),
    )
    .map((e) => e.task);

  const otherPlanned = primary.filter(
    (e) => !e.task.custom_fields.monthly_priority && e.task.custom_fields.is_adhoc !== "true",
  );
  const adhoc = primary.filter((e) => e.task.custom_fields.is_adhoc === "true");
  const trails = entries.filter((e) => e.kind !== "primary");

  return (
    <div className={styles.col}>
      <header className={styles.head}>
        <div className={styles.eyebrow}>MONTH · 規劃</div>
        <h2 className={styles.title}>{formatMonth(month)}</h2>
      </header>

      <BacklogSection allTasks={allTasks} />

      {top3.length > 0 && <MonthHeroCard top3={top3} />}

      {otherPlanned.length > 0 && (
        <section className={styles.section}>
          <header className={styles.sectionHead}>其他計劃內</header>
          {otherPlanned.map((e) => (
            <MonthRow key={e.task.id} task={e.task} kind={e.kind} />
          ))}
        </section>
      )}

      {adhoc.length > 0 && (
        <section className={styles.section}>
          <header className={[styles.sectionHead, styles.adhocHead].join(" ")}>計劃外</header>
          {adhoc.map((e) => (
            <MonthRow key={e.task.id} task={e.task} kind={e.kind} />
          ))}
        </section>
      )}

      {trails.length > 0 && (
        <section className={styles.section}>
          {trails.map((e) => (
            <MonthRow key={e.task.id} task={e.task} kind={e.kind} />
          ))}
        </section>
      )}
    </div>
  );
}
