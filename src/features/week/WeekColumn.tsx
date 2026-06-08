import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { Task } from "@/lib/types";
import { tasksOnDate } from "@/lib/tasks";
import { weekOf, shortWeekday, dayOfMonth, isoWeek, addDays } from "@/lib/date";
import { useDroppableZone } from "@/features/plan-view/useDroppableZone";
import styles from "./WeekColumn.module.css";

export interface WeekColumnProps {
  allTasks: Task[];
  selectedDate: string;
}

interface WeekDayCellProps {
  date: string;
  allTasks: Task[];
  selectedDate: string;
}

function WeekDayCell({ date, allTasks, selectedDate }: WeekDayCellProps) {
  const top3Drop = useDroppableZone({ kind: "day", date, zone: "top3" });
  const otherDrop = useDroppableZone({ kind: "day", date, zone: "other" });
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
  // Tasks scheduled on this day that aren't shown as one of the top-3
  // (planned-without-priority + adhoc). Surfaces work added to "其他".
  const otherCount = primary.length - top3.length;
  const isSelected = date === selectedDate;

  return (
    <li className={styles.dayItem}>
      <Link
        to="/plan/$date"
        params={{ date }}
        className={[styles.day, isSelected && styles.selected].filter(Boolean).join(" ")}
        aria-label={`切到 ${date}`}
        aria-current={isSelected ? "date" : undefined}
      >
        <div className={styles.dayBox}>
          <div className={styles.dayNum}>{dayOfMonth(date)}</div>
          <div className={styles.dayWk}>{shortWeekday(date).toUpperCase()}</div>
        </div>
        <div className={styles.cellBody}>
          <ol
            ref={top3Drop.ref}
            className={[styles.tasks, styles.zone, top3Drop.isOver && styles.isOver]
              .filter(Boolean)
              .join(" ")}
          >
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
            {top3.length === 0 && top3Drop.isOver && <li className={styles.zoneHint}>三件事</li>}
          </ol>
          <div
            ref={otherDrop.ref}
            className={[styles.otherZone, styles.zone, otherDrop.isOver && styles.isOver]
              .filter(Boolean)
              .join(" ")}
          >
            {otherCount > 0 ? (
              <span className={styles.more}>還有 {otherCount} 件其他任務</span>
            ) : (
              otherDrop.isOver && <span className={styles.zoneHint}>其他</span>
            )}
          </div>
          {primary.length === 0 && <div className={styles.empty}>—</div>}
        </div>
      </Link>
    </li>
  );
}

export function WeekColumn({ allTasks, selectedDate }: WeekColumnProps) {
  const week = useMemo(() => weekOf(selectedDate), [selectedDate]);

  return (
    <div className={styles.col}>
      <header className={styles.head}>
        <div className={styles.eyebrow}>WEEK · 規劃</div>
        <div className={styles.titleRow}>
          <Link
            to="/plan/$date"
            params={{ date: addDays(selectedDate, -7) }}
            className={styles.step}
            aria-label="上一週"
          >
            ‹
          </Link>
          <h2 className={styles.title}>第 {isoWeek(selectedDate)} 週</h2>
          <Link
            to="/plan/$date"
            params={{ date: addDays(selectedDate, 7) }}
            className={styles.step}
            aria-label="下一週"
          >
            ›
          </Link>
        </div>
        <div className={styles.meta}>
          {dayOfMonth(week[0])}/{Number(week[0].slice(5, 7))} – {dayOfMonth(week[6])}/
          {Number(week[6].slice(5, 7))} · 每日三件事
        </div>
      </header>

      <ul className={styles.list}>
        {week.map((date) => (
          <WeekDayCell key={date} date={date} allTasks={allTasks} selectedDate={selectedDate} />
        ))}
      </ul>
    </div>
  );
}
