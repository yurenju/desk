import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Task } from "@/lib/types";
import { tasksOnMonth } from "@/lib/tasks";
import { formatMonth, addMonths } from "@/lib/date";
import { isAdhocOf } from "@/lib/entryMode";
import { useTasksStore } from "@/store/tasks";
import { BacklogSection } from "@/features/backlog/BacklogSection";
import { useDroppableZone } from "@/features/plan-view/useDroppableZone";
import { MonthHeroCard } from "./MonthHeroCard";
import { MonthRow } from "./MonthRow";
import { AddTaskBar } from "@/ui/AddTaskBar";
import styles from "./MonthColumn.module.css";

export interface MonthColumnProps {
  allTasks: Task[];
  month: string;
  selectedDate: string;
}

export function MonthColumn({ allTasks, month, selectedDate }: MonthColumnProps) {
  const { ref: dropRef, isOver } = useDroppableZone({ kind: "month" });
  const addMonthTask = useTasksStore((s) => s.addMonthTask);
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

  // Everything outside top3, partitioned by what the user is actually looking at:
  // live tasks to do this month, things already done (whatever path they took),
  // and undone tasks that have moved away (forwarded to a later month / dismissed).
  const rest = entries.filter(
    (e) => !(e.kind === "primary" && e.task.custom_fields.monthly_priority),
  );
  const undoneOthers = rest.filter((e) => e.kind === "primary" && e.task.status !== "done");
  const doneAll = rest.filter((e) => e.task.status === "done");
  const movedAway = rest.filter((e) => e.kind !== "primary" && e.task.status !== "done");

  const nothing =
    top3.length === 0 &&
    undoneOthers.length === 0 &&
    doneAll.length === 0 &&
    movedAway.length === 0;

  return (
    <div ref={dropRef} className={[styles.col, isOver && styles.isOver].filter(Boolean).join(" ")}>
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

      {undoneOthers.length > 0 && (
        <section className={styles.section}>
          <header className={styles.sectionHead}>其他任務</header>
          {undoneOthers.map((e) => (
            <MonthRow
              key={e.task.id}
              task={e.task}
              kind={e.kind}
              month={month}
              selectedDate={selectedDate}
              interactive
              showRing
            />
          ))}
        </section>
      )}

      {doneAll.length > 0 && (
        <CollapseGroup label="已完成" count={doneAll.length}>
          {doneAll.map((e) => (
            <MonthRow
              key={e.task.id}
              task={e.task}
              kind={e.kind}
              month={month}
              selectedDate={selectedDate}
              interactive
              showRing
            />
          ))}
        </CollapseGroup>
      )}

      {movedAway.length > 0 && (
        <CollapseGroup label="已移走" count={movedAway.length}>
          {movedAway.map((e) => (
            <MonthRow
              key={e.task.id}
              task={e.task}
              kind={e.kind}
              month={month}
              selectedDate={selectedDate}
              interactive
            />
          ))}
        </CollapseGroup>
      )}

      {nothing && <div className={styles.empty}>這個月還沒有任務</div>}

      <AddTaskBar
          placeholder="+ 加一件這個月要做的事…"
          ariaLabel="新增本月任務"
          withMode
          onSubmit={(title, mode) => addMonthTask(title, month, isAdhocOf(mode))}
        />
    </div>
  );
}

/** Collapsible, default-collapsed group (e.g. 已完成 / 已移走) of month rows. */
function CollapseGroup({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.doneGroup}>
      <button
        type="button"
        className={styles.doneToggle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "▾" : "▸"} {label} ({count})
      </button>
      {open && children}
    </div>
  );
}
