import { useMemo } from "react";
import type { Task } from "@/lib/types";
import { tasksOnMonth, monthlyRankOn } from "@/lib/tasks";
import { formatMonth, dayOfMonth } from "@/lib/date";
import { ProgressBar } from "@/ui/ProgressBar";
import { Top3Card } from "@/features/day/Top3Card";
import { Link } from "@tanstack/react-router";
import styles from "./MonthDigest.module.css";

export interface MonthDigestProps {
  allTasks: Task[];
  month: string;
  today: string;
  selectedDate: string;
}

export function MonthDigest({ allTasks, month, today, selectedDate }: MonthDigestProps) {
  const entries = useMemo(() => tasksOnMonth(allTasks, month), [allTasks, month]);
  const primary = entries.filter((e) => e.kind === "primary");

  const top3 = primary
    .filter((e) => monthlyRankOn(e.task, month))
    .sort(
      (a, b) =>
        Number(monthlyRankOn(a.task, month)) -
        Number(monthlyRankOn(b.task, month)),
    );

  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const dayN = dayOfMonth(today);
  const pct = dayN / daysInMonth;

  const completed = primary.filter((e) => e.task.status === "done").length;

  return (
    <div className={styles.col}>
      <header className={styles.head}>
        <div className={styles.eyebrow}>MONTH</div>
        <h3 className={styles.title}>{formatMonth(month)}</h3>
        <div className={styles.meta}>
          DAY {dayN} / {daysInMonth}
        </div>
      </header>

      <div className={styles.progressRow}>
        <ProgressBar value={pct} ariaLabel="本月進度" />
        <div className={styles.progressLabel}>
          月份過了 {Math.round(pct * 100)}%,計劃內已完成 {completed}/{primary.length}
        </div>
      </div>

      {top3.length > 0 && (
        <Top3Card entries={top3} title="本月三件大事" date={today} variant="plain" />
      )}

      <Link to="/plan/$date" params={{ date: selectedDate }} className={styles.editLink}>
        在計畫頁編輯本月 →
      </Link>
    </div>
  );
}
