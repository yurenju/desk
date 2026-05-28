import { useMemo } from "react";
import type { Task } from "@/lib/types";
import { tasksOnDate } from "@/lib/tasks";
import { weekOf, shortWeekday, dayOfMonth, isoWeek } from "@/lib/date";
import styles from "./WeekColumn.module.css";

export interface WeekColumnProps {
  allTasks: Task[];
  selectedDate: string;
}

export function WeekColumn({ allTasks, selectedDate }: WeekColumnProps) {
  const week = useMemo(() => weekOf(selectedDate), [selectedDate]);

  return (
    <div className={styles.col}>
      <header className={styles.head}>
        <div className={styles.eyebrow}>WEEK · 規劃</div>
        <h2 className={styles.title}>第 {isoWeek(selectedDate)} 週</h2>
        <div className={styles.meta}>
          {dayOfMonth(week[0])}/{Number(week[0].slice(5, 7))} – {dayOfMonth(week[6])}/
          {Number(week[6].slice(5, 7))} · 每日三件事
        </div>
      </header>

      <ul className={styles.list}>
        {week.map((date) => {
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
          const isSelected = date === selectedDate;
          return (
            <li
              key={date}
              className={[styles.day, isSelected && styles.selected].filter(Boolean).join(" ")}
            >
              <div className={styles.dayBox}>
                <div className={styles.dayNum}>{dayOfMonth(date)}</div>
                <div className={styles.dayWk}>{shortWeekday(date).toUpperCase()}</div>
              </div>
              <ol className={styles.tasks}>
                {top3.map((e, i) => (
                  <li
                    key={e.task.id}
                    className={[styles.task, e.task.status === "done" && styles.done]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className={styles.taskOrder}>{i + 1}.</span> {e.task.title}
                  </li>
                ))}
                {top3.length === 0 && <li className={styles.empty}>—</li>}
              </ol>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
