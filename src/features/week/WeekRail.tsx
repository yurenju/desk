import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { Task } from "@/lib/types";
import { tasksOnDate, dailyRankOn } from "@/lib/tasks";
import { weekOf, shortWeekday, dayOfMonth, isoWeek } from "@/lib/date";
import styles from "./WeekRail.module.css";

export interface WeekRailProps {
  allTasks: Task[];
  /** The week to display (any date within it). Independent of the focus day. */
  weekAnchor: string;
  /** The focus day, highlighted only when it falls inside the displayed week. */
  selectedDate: string;
  today: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onResetToToday: () => void;
}

export function WeekRail({
  allTasks,
  weekAnchor,
  selectedDate,
  today,
  onPrevWeek,
  onNextWeek,
  onResetToToday,
}: WeekRailProps) {
  const week = useMemo(() => weekOf(weekAnchor), [weekAnchor]);
  // Show the reset when either the focus day is off today OR the rail has been
  // paged away from today's week (so it doubles as "bring the rail home").
  const showReset = selectedDate !== today || week[0] !== weekOf(today)[0];

  return (
    <nav className={styles.rail} aria-label="週導覽">
      <header className={styles.head}>
        <div className={styles.eyebrow}>WEEK {isoWeek(weekAnchor)}</div>
        <div className={styles.nav}>
          <button type="button" onClick={onPrevWeek} className={styles.step} aria-label="上一週">
            ‹
          </button>
          <div className={styles.range}>
            {dayOfMonth(week[0])}/{Number(week[0].slice(5, 7))} – {dayOfMonth(week[6])}/
            {Number(week[6].slice(5, 7))}
          </div>
          <button type="button" onClick={onNextWeek} className={styles.step} aria-label="下一週">
            ›
          </button>
        </div>
        {showReset && (
          <Link
            to="/focus/$date"
            params={{ date: today }}
            onClick={onResetToToday}
            className={styles.todayLink}
          >
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
            .filter((e) => dailyRankOn(e.task, date))
            .sort((a, b) => Number(dailyRankOn(a.task, date)) - Number(dailyRankOn(b.task, date)))
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
