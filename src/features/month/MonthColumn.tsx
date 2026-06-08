import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { Task } from "@/lib/types";
import { tasksOnMonth } from "@/lib/tasks";
import { formatMonth, addMonths } from "@/lib/date";
import { BacklogSection } from "@/features/backlog/BacklogSection";
import { useDroppableZone } from "@/features/plan-view/useDroppableZone";
import { MonthHeroCard } from "./MonthHeroCard";
import { MonthRow } from "./MonthRow";
import { AddMonthTaskInput } from "./AddMonthTaskInput";
import styles from "./MonthColumn.module.css";

export interface MonthColumnProps {
  allTasks: Task[];
  month: string;
  selectedDate: string;
}

export function MonthColumn({ allTasks, month, selectedDate }: MonthColumnProps) {
  const drop = useDroppableZone({ kind: "month" });
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
  const adhoc = primary.filter(
    (e) => !e.task.custom_fields.monthly_priority && e.task.custom_fields.is_adhoc === "true",
  );
  const trails = entries.filter((e) => e.kind !== "primary");

  const nothing =
    top3.length === 0 && otherPlanned.length === 0 && adhoc.length === 0 && trails.length === 0;

  return (
    <div
      ref={drop.ref}
      className={[styles.col, drop.isOver && styles.isOver].filter(Boolean).join(" ")}
    >
      <header className={styles.head}>
        <div className={styles.eyebrow}>MONTH · 規劃</div>
        <div className={styles.titleRow}>
          <Link
            to="/plan/$date"
            params={{ date: addMonths(selectedDate, -1) }}
            className={styles.step}
            aria-label="上個月"
          >
            ‹
          </Link>
          <h2 className={styles.title}>{formatMonth(month)}</h2>
          <Link
            to="/plan/$date"
            params={{ date: addMonths(selectedDate, 1) }}
            className={styles.step}
            aria-label="下個月"
          >
            ›
          </Link>
        </div>
      </header>

      <BacklogSection allTasks={allTasks} focusDate={selectedDate} />

      {top3.length > 0 && <MonthHeroCard top3={top3} month={month} selectedDate={selectedDate} />}

      {otherPlanned.length > 0 && (
        <section className={styles.section}>
          <header className={styles.sectionHead}>其他計劃內</header>
          {otherPlanned.map((e) => (
            <MonthRow key={e.task.id} task={e.task} kind={e.kind}
              month={month} selectedDate={selectedDate} interactive showRing />
          ))}
        </section>
      )}

      {adhoc.length > 0 && (
        <section className={styles.section}>
          <header className={[styles.sectionHead, styles.adhocHead].join(" ")}>計劃外</header>
          {adhoc.map((e) => (
            <MonthRow key={e.task.id} task={e.task} kind={e.kind}
              month={month} selectedDate={selectedDate} interactive showRing />
          ))}
        </section>
      )}

      {trails.length > 0 && (
        <section className={styles.section}>
          {trails.map((e) => (
            <MonthRow key={e.task.id} task={e.task} kind={e.kind}
              month={month} selectedDate={selectedDate} />
          ))}
        </section>
      )}

      {nothing && <div className={styles.empty}>這個月還沒有任務</div>}

      <AddMonthTaskInput month={month} />
    </div>
  );
}
