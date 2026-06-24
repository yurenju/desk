import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Task } from "@/lib/types";
import { tasksOnMonth, dayInWeek, primaryDate, byPosition } from "@/lib/tasks";
import { formatMonth, addMonths, weekOf, weekdayZh, shortDate } from "@/lib/date";
import { isAdhocOf } from "@/lib/entryMode";
import { useTasksStore } from "@/store/tasks";
import { BacklogSection } from "@/features/backlog/BacklogSection";
import { useDroppableZone } from "@/features/plan-view/useDroppableZone";
import { SortableSection } from "@/features/plan-view/SortableSection";
import { containerId } from "@/features/plan-view/planDrag";
import { useDragOrdering } from "@/features/plan-view/useDragOrdering";
import { MonthHeroCard } from "./MonthHeroCard";
import { MonthRow, SortableMonthRow } from "./MonthRow";
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
  const week = useMemo(() => weekOf(selectedDate), [selectedDate]);
  const entries = useMemo(() => tasksOnMonth(allTasks, month), [allTasks, month]);

  const top3 = entries
    .filter((e) => e.kind === "primary" && e.task.custom_fields.monthly_priority)
    .sort(
      (a, b) =>
        Number(a.task.custom_fields.monthly_priority) -
        Number(b.task.custom_fields.monthly_priority),
    )
    .map((e) => e.task);

  // Everything outside top3, partitioned by precedence (first match wins):
  // 1) placed on a day in the viewed week (incl. done), 2) done elsewhere,
  // 3) moved away (undone, forwarded/dismissed), 4) the live "other tasks" pool.
  const rest = entries.filter(
    (e) => !(e.kind === "primary" && e.task.custom_fields.monthly_priority),
  );
  const scheduledThisWeek = rest
    .filter((e) => dayInWeek(e.task, week) !== null)
    .sort((a, b) => (dayInWeek(a.task, week)! < dayInWeek(b.task, week)! ? -1 : 1));
  const remaining = rest.filter((e) => dayInWeek(e.task, week) === null);
  const doneOther = remaining.filter((e) => e.task.status === "done");
  const undone = remaining.filter((e) => e.task.status !== "done");
  const movedAway = undone.filter((e) => e.kind !== "primary");
  // 計劃外 (adhoc) sinks below 計劃內; tiebreak by position for manual ordering.
  const others = undone
    .filter((e) => e.kind === "primary")
    .sort((a, b) => {
      const adhocDelta =
        Number(a.task.custom_fields.is_adhoc === "true") - Number(b.task.custom_fields.is_adhoc === "true");
      return adhocDelta !== 0 ? adhocDelta : byPosition(a.task, b.task);
    });

  // Live drag preview for the 其他任務 pool (and the monthTop3 displacement that
  // pushes the 4th into the pool head). `taskById` spans top3 + others so an
  // overflow preview can resolve a task pulled out of the hero card.
  const { previewOrder } = useDragOrdering();
  const monthTaskById = new Map<string, Task>();
  for (const t of top3) monthTaskById.set(`month:${t.id}`, t);
  for (const e of others) monthTaskById.set(`month:${e.task.id}`, e.task);
  const poolCid = containerId({ kind: "poolMonth", month });
  const othersBaseIds = others.map((e) => `month:${e.task.id}`);
  const othersOrdered = previewOrder(poolCid, othersBaseIds)
    .map((id) => monthTaskById.get(id))
    .filter((t): t is Task => Boolean(t));

  const nothing =
    top3.length === 0 &&
    others.length === 0 &&
    scheduledThisWeek.length === 0 &&
    doneOther.length === 0 &&
    movedAway.length === 0;

  return (
    <div ref={dropRef} data-testid="month-column" className={[styles.col, isOver && styles.isOver].filter(Boolean).join(" ")}>
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

      {top3.length > 0 && (
        <MonthHeroCard
          top3={top3}
          month={month}
          selectedDate={selectedDate}
          taskById={monthTaskById}
        />
      )}

      {othersOrdered.length > 0 && (
        <section className={styles.section}>
          <header className={styles.sectionHead}>其他任務</header>
          <SortableSection id={poolCid} items={othersOrdered.map((t) => `month:${t.id}`)}>
            {othersOrdered.map((t) => {
              const pd = primaryDate(t);
              const otherWeekDate = pd && !week.includes(pd) ? shortDate(pd) : undefined;
              return (
                <SortableMonthRow
                  key={t.id}
                  task={t}
                  kind="primary"
                  month={month}
                  selectedDate={selectedDate}
                  interactive
                  showRing
                  otherWeekDate={otherWeekDate}
                />
              );
            })}
          </SortableSection>
        </section>
      )}

      {scheduledThisWeek.length > 0 && (
        <CollapseGroup
          label="已排入本週"
          count={scheduledThisWeek.length}
          persistKey="desk.plan.month.collapse.scheduledThisWeek"
        >
          {scheduledThisWeek.map((e) => (
            <MonthRow
              key={e.task.id}
              task={e.task}
              kind={e.kind}
              month={month}
              selectedDate={selectedDate}
              interactive
              showRing
              weekdayLabel={weekdayZh(dayInWeek(e.task, week)!)}
            />
          ))}
        </CollapseGroup>
      )}

      {doneOther.length > 0 && (
        <CollapseGroup
          label="其他已完成"
          count={doneOther.length}
          persistKey="desk.plan.month.collapse.doneOther"
        >
          {doneOther.map((e) => (
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
        <CollapseGroup
          label="已移走"
          count={movedAway.length}
          persistKey="desk.plan.month.collapse.movedAway"
        >
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

function readOpen(key: string): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(key) === "open";
}
function writeOpen(key: string, open: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, open ? "open" : "collapsed");
}

/** Collapsible group (e.g. 已排入本週 / 其他已完成 / 已移走) whose open/closed
 * state persists in localStorage under `persistKey` (default collapsed). */
function CollapseGroup({
  label,
  count,
  persistKey,
  children,
}: {
  label: string;
  count: number;
  persistKey: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(persistKey));
  function toggle() {
    setOpen((v) => {
      writeOpen(persistKey, !v);
      return !v;
    });
  }
  return (
    <div className={styles.doneGroup}>
      <button
        type="button"
        className={styles.doneToggle}
        aria-expanded={open}
        onClick={toggle}
      >
        {open ? "▾" : "▸"} {label} ({count})
      </button>
      {open && children}
    </div>
  );
}
