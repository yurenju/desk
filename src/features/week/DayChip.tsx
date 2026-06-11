import { Link } from "@tanstack/react-router";
import type { Task } from "@/lib/types";
import { tasksOnDate } from "@/lib/tasks";
import { dayOfMonth, shortWeekday } from "@/lib/date";
import styles from "./DayChip.module.css";

export interface DayChipProps {
  date: string;
  today: string;
  selected: boolean;
  allTasks: Task[];
}

export function DayChip({ date, today, selected, allTasks }: DayChipProps) {
  const count = tasksOnDate(allTasks, date).filter((e) => e.kind === "primary").length;
  const isToday = date === today;
  return (
    <Link
      to="/focus/$date"
      params={{ date }}
      aria-label={`切到 ${date}`}
      className={[styles.chip, selected && styles.selected, isToday && styles.today]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.wk}>{shortWeekday(date).toUpperCase()}</div>
      <div className={styles.num}>{dayOfMonth(date)}</div>
      <div className={styles.count}>{count} 件</div>
    </Link>
  );
}
