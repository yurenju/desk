import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { Task } from "@/lib/types";
import { tasksOnDate } from "@/lib/tasks";
import { weekOf, shortWeekday, dayOfMonth, isoWeek, addDays } from "@/lib/date";
import styles from "./WeekRail.module.css";

export interface WeekRailProps {
  allTasks: Task[];
  selectedDate: string;
  today: string;
}

export function WeekRail({ allTasks, selectedDate, today }: WeekRailProps) {
  const week = useMemo(() => weekOf(selectedDate), [selectedDate]);

  return (
    <nav className={styles.rail} aria-label="週導覽">
      <header className={styles.head}>
        <div className={styles.eyebrow}>WEEK {isoWeek(selectedDate)}</div>
        <div className={styles.nav}>
          <Link
            to="/focus/$date"
            params={{ date: addDays(selectedDate, -7) }}
            className={styles.step}
            aria-label="上一週"
          >
            ‹
          </Link>
          <div className={styles.range}>
            {dayOfMonth(week[0])}/{Number(week[0].slice(5, 7))} – {dayOfMonth(week[6])}/
            {Number(week[6].slice(5, 7))}
          </div>
          <Link
            to="/focus/$date"
            params={{ date: addDays(selectedDate, 7) }}
            className={styles.step}
            aria-label="下一週"
          >
            ›
          </Link>
        </div>
        {selectedDate !== today && (
          <Link to="/focus/$date" params={{ date: today }} className={styles.todayLink}>
            回今天
          </Link>
        )}
      </header>

      <ul className={styles.list}>
        {week.map((date) => {
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const entries = tasksOnDate(allTasks, date);
          const primary = entries.filter((e) => e.kind === "primary");
          const top3 = primary
            .filter((e) => e.task.custom_fields.daily_priority)
            .sort(
              (a, b) =>
                Number(a.task.custom_fields.daily_priority) -
                Number(b.task.custom_fields.daily_priority),
            )
            .slice(0, 3);
          return (
            <li key={date} className={styles.dayItem}>
              <Link
                to="/focus/$date"
                params={{ date }}
                aria-label={`切到 ${date}`}
                className={[styles.day, isSelected && styles.selected]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className={styles.dayHeader}>
                  <span className={styles.num}>{dayOfMonth(date)}</span>
                  <span className={styles.wk}>{shortWeekday(date).toUpperCase()}</span>
                  {isToday && <span className={styles.todayTag}>今天</span>}
                </div>
                <ul className={styles.tasks}>
                  {top3.map((e) => (
                    <li
                      key={e.task.id}
                      className={[styles.task, e.task.status === "done" && styles.done]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {e.task.title}
                    </li>
                  ))}
                </ul>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
