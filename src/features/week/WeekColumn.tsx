import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { Task } from "@/lib/types";
import { tasksOnDate } from "@/lib/tasks";
import { weekOf, shortWeekday, dayOfMonth, isoWeek, addDays } from "@/lib/date";
import { useDroppableZone } from "@/features/plan-view/useDroppableZone";
import { useDraggableRow } from "@/features/plan-view/useDraggableRow";
import styles from "./WeekColumn.module.css";

export interface WeekColumnProps {
  allTasks: Task[];
  selectedDate: string;
}

interface WeekTaskItemProps {
  taskId: string;
  date: string;
  order: number;
  title: string;
  done: boolean;
}

function WeekTaskItem({ taskId, date, order, title, done }: WeekTaskItemProps) {
  const draggable = useDraggableRow(`week:${date}:${taskId}`);
  return (
    <li
      ref={draggable.ref}
      {...draggable.handleProps}
      className={[styles.task, done && styles.done].filter(Boolean).join(" ")}
    >
      <span className={styles.taskOrder}>{order}.</span> {title}
    </li>
  );
}

interface WeekDayCellProps {
  date: string;
  allTasks: Task[];
  selectedDate: string;
}

function WeekDayCell({ date, allTasks, selectedDate }: WeekDayCellProps) {
  // One droppable per cell. top-3 vs other is decided by the drop's vertical
  // position (upper half = top-3) in PlanLayout — two stacked sub-zones this
  // small are unreliable for dnd-kit collision when dragging within one cell.
  const cellDrop = useDroppableZone({ kind: "weekday", date });
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
        {/* Single droppable for the whole cell. Content stays identical while
            dragging over (only the outline changes) so the layout never shifts
            mid-drag — a shift would move the zones out from under the pointer. */}
        <div
          ref={cellDrop.ref}
          data-testid={`week-cell-${date}`}
          className={[styles.cellBody, cellDrop.isOver && styles.isOver].filter(Boolean).join(" ")}
        >
          <ol data-testid={`week-top3-${date}`} className={styles.tasks}>
            {top3.map((e, i) => (
              <WeekTaskItem
                key={e.task.id}
                taskId={e.task.id}
                date={date}
                order={i + 1}
                title={e.task.title}
                done={e.task.status === "done"}
              />
            ))}
          </ol>
          <div className={styles.otherZone}>
            {otherCount > 0 && <span className={styles.more}>還有 {otherCount} 件其他任務</span>}
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
