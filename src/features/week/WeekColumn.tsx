import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { Task } from "@/lib/types";
import { tasksOnDate } from "@/lib/tasks";
import { weekOf, shortWeekday, dayOfMonth, isoWeek, addDays } from "@/lib/date";
import { useDroppableZone } from "@/features/plan-view/useDroppableZone";
import { useDraggableRow } from "@/features/plan-view/useDraggableRow";
import { useWeekDropHint } from "@/features/plan-view/dragContext";
import styles from "./WeekColumn.module.css";

export interface WeekColumnProps {
  allTasks: Task[];
  selectedDate: string;
}

interface WeekTaskItemProps {
  taskId: string;
  date: string;
  // 1/2/3 for the day's top-3; omitted for "other" tasks (rendered with a bullet).
  order?: number;
  title: string;
  done: boolean;
}

function WeekTaskItem({ taskId, date, order, title, done }: WeekTaskItemProps) {
  const draggable = useDraggableRow(`week:${date}:${taskId}`);
  return (
    <li
      ref={draggable.ref}
      {...draggable.handleProps}
      className={[styles.task, done && styles.done, order == null && styles.otherTask]
        .filter(Boolean)
        .join(" ")}
    >
      <span className={styles.taskOrder}>{order == null ? "·" : `${order}.`}</span> {title}
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
  // Tasks scheduled on this day that aren't one of the top-3
  // (planned-without-priority + adhoc). Rendered as draggable items too so the
  // user can drag one UP into the top-3 (promote) directly from the week cell.
  // `top3` is filtered+sliced from `primary`, so its entries are the same object
  // references — reference-equality exclusion is correct here.
  const others = primary.filter((e) => !top3.includes(e));
  const isSelected = date === selectedDate;

  // Live drop hint: which half of THIS cell the pointer is over mid-drag.
  const hint = useWeekDropHint();
  const overCell = hint?.date === date;
  const overTop3 = overCell && hint.zone === "top3";
  const overOther = overCell && hint.zone === "other";

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
        {/* Single droppable for the whole cell. The drop hint badges/highlights
            below are absolutely positioned, so showing them mid-drag does NOT
            shift the cell layout (a shift would move the zone out from under the
            pointer and break the drop). */}
        <div
          ref={cellDrop.ref}
          data-testid={`week-cell-${date}`}
          className={[styles.cellBody, cellDrop.isOver && styles.isOver].filter(Boolean).join(" ")}
        >
          {overCell && (
            <>
              <span
                className={[styles.dropTag, styles.dropTagTop, overTop3 && styles.dropTagActive]
                  .filter(Boolean)
                  .join(" ")}
                aria-hidden
              >
                ↑ 三件事
              </span>
              <span
                className={[styles.dropTag, styles.dropTagBottom, overOther && styles.dropTagActive]
                  .filter(Boolean)
                  .join(" ")}
                aria-hidden
              >
                ↓ 其他
              </span>
            </>
          )}
          <ol
            data-testid={`week-top3-${date}`}
            className={[styles.tasks, overTop3 && styles.halfActive].filter(Boolean).join(" ")}
          >
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
          <ul
            className={[styles.otherZone, overOther && styles.halfActive].filter(Boolean).join(" ")}
          >
            {others.map((e) => (
              <WeekTaskItem
                key={e.task.id}
                taskId={e.task.id}
                date={date}
                title={e.task.title}
                done={e.task.status === "done"}
              />
            ))}
          </ul>
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
