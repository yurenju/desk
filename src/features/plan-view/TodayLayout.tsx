import type { Task } from "@/lib/types";
import { WeekRail } from "@/features/week/WeekRail";
import { DayColumn } from "@/features/day/DayColumn";
import { MonthDigest } from "@/features/month/MonthDigest";
import { DayChip } from "@/features/week/DayChip";
import { Link } from "@tanstack/react-router";
import { weekOf, addDays } from "@/lib/date";
import { DeleteUndoToast } from "@/features/day/DeleteUndoToast";
import styles from "./TodayLayout.module.css";

export interface TodayLayoutProps {
  allTasks: Task[];
  selectedDate: string;
  today: string;
  month: string;
}

export function TodayLayout({ allTasks, selectedDate, today, month }: TodayLayoutProps) {
  const week = weekOf(selectedDate);

  return (
    <main className={styles.page}>
      <div className={styles.grid}>
        <aside className={[styles.cell, styles.left].join(" ")}>
          <WeekRail allTasks={allTasks} selectedDate={selectedDate} today={today} />
        </aside>
        <section className={[styles.cell, styles.center].join(" ")}>
          <DayColumn allTasks={allTasks} selectedDate={selectedDate} variant="today-hero" />
        </section>
        <aside className={[styles.cell, styles.right].join(" ")}>
          <MonthDigest allTasks={allTasks} month={month} today={today} selectedDate={selectedDate} />
        </aside>
      </div>

      <nav className={styles.mobileChips} aria-label="日期切換">
        <Link
          to="/focus/$date"
          params={{ date: addDays(selectedDate, -7) }}
          className={styles.chipStep}
          aria-label="上一週"
        >
          ‹
        </Link>
        {week.map((date) => (
          <DayChip
            key={date}
            date={date}
            today={today}
            selected={date === selectedDate}
            allTasks={allTasks}
          />
        ))}
        <Link
          to="/focus/$date"
          params={{ date: addDays(selectedDate, 7) }}
          className={styles.chipStep}
          aria-label="下一週"
        >
          ›
        </Link>
      </nav>

      <DeleteUndoToast />
    </main>
  );
}
