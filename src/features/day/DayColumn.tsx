import { useMemo } from "react";
import type { Task } from "@/lib/types";
import { tasksOnDate } from "@/lib/tasks";
import { dayOfMonth, shortWeekday } from "@/lib/date";
import { useTasksStore } from "@/store/tasks";
import { useDroppableZone } from "@/features/plan-view/useDroppableZone";
import { TaskRow } from "./TaskRow";
import { Top3Card } from "./Top3Card";
import { AddTaskBar } from "@/ui/AddTaskBar";
import { isAdhocOf } from "@/lib/entryMode";
import styles from "./DayColumn.module.css";

export interface DayColumnProps {
  allTasks: Task[];
  selectedDate: string;
  variant: "plan-narrow" | "today-hero";
  interactive?: boolean;
}

export function DayColumn({ allTasks, selectedDate, variant, interactive }: DayColumnProps) {
  const storeToday = useTasksStore((s) => s.today);
  const addTodayTask = useTasksStore((s) => s.addTodayTask);
  const entries = useMemo(() => tasksOnDate(allTasks, selectedDate), [allTasks, selectedDate]);

  const primary = entries.filter((e) => e.kind === "primary");

  const top3 = primary
    .filter((e) => e.task.custom_fields.daily_priority)
    .sort(
      (a, b) =>
        Number(a.task.custom_fields.daily_priority) - Number(b.task.custom_fields.daily_priority),
    )
    .map((e) => e.task);

  const otherPlanned = primary.filter(
    (e) => !e.task.custom_fields.daily_priority && e.task.custom_fields.is_adhoc !== "true",
  );

  // Exclude tasks already promoted to Top3 (mirrors otherPlanned) so a
  // prioritised adhoc task isn't rendered in both sections.
  const adhoc = primary.filter(
    (e) => !e.task.custom_fields.daily_priority && e.task.custom_fields.is_adhoc === "true",
  );

  const trails = entries.filter((e) => e.kind !== "primary");

  const isEmpty =
    top3.length === 0 && otherPlanned.length === 0 && adhoc.length === 0 && trails.length === 0;

  const isInteractive = interactive ?? variant === "today-hero";
  const { ref: top3Ref, isOver: top3IsOver } = useDroppableZone({
    kind: "day",
    date: selectedDate,
    zone: "top3",
  });
  const { ref: otherRef, isOver: otherIsOver } = useDroppableZone({
    kind: "day",
    date: selectedDate,
    zone: "other",
  });
  // "today" is the store's notion of today (set to the real local date at load),
  // the single source of truth — not a fresh todayISO() read, which would
  // disagree in tests and at a midnight rollover.
  const isToday = selectedDate === storeToday;

  return (
    <div className={[styles.col, styles[`v_${variant}`]].join(" ")}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>
          {shortWeekday(selectedDate).toUpperCase()}
          {isToday ? " · 今天" : ""}
        </div>
        <h2 className={styles.bigDate}>
          {monthShort(selectedDate)} {dayOfMonth(selectedDate)}
        </h2>
      </div>

      <div
        ref={top3Ref}
        data-testid="top3-drop-zone"
        className={[styles.dropZone, top3IsOver && styles.isOver].filter(Boolean).join(" ")}
      >
        {top3.length > 0 ? (
          <Top3Card
            tasks={top3}
            title={isToday ? "今天最重要的三件事" : "最重要的三件事"}
            variant="accent"
            date={selectedDate}
            interactive={isInteractive}
          />
        ) : (
          isInteractive &&
          top3IsOver && <div className={styles.dropHint}>拖到這裡 → 今天三件事</div>
        )}
      </div>

      <div
        ref={otherRef}
        className={[styles.dropZone, otherIsOver && styles.isOver].filter(Boolean).join(" ")}
      >
        {otherPlanned.length > 0 && (
          <section className={styles.section}>
            <header className={styles.sectionHead}>
              其他計劃內 <span className={styles.count}>{otherPlanned.length}</span>
            </header>
            {otherPlanned.map((e) => (
              <TaskRow
                key={e.task.id}
                task={e.task}
                kind={e.kind}
                date={selectedDate}
                interactive={isInteractive}
                showRing={isInteractive}
              />
            ))}
          </section>
        )}

        {adhoc.length > 0 && (
          <section className={styles.section}>
            <header className={[styles.sectionHead, styles.adhocHead].join(" ")}>
              {isToday ? "今天臨時加的" : "臨時加的"}{" "}
              <span className={styles.count}>{adhoc.length}</span>
            </header>
            {adhoc.map((e) => (
              <TaskRow
                key={e.task.id}
                task={e.task}
                kind={e.kind}
                date={selectedDate}
                showAdhocChip
                interactive={isInteractive}
                showRing={isInteractive}
              />
            ))}
          </section>
        )}

        {isInteractive && otherPlanned.length === 0 && adhoc.length === 0 && otherIsOver && (
          <div className={styles.dropHint}>拖到這裡 → 其他計劃內</div>
        )}
      </div>

      {trails.length > 0 && (
        <section className={styles.section}>
          {trails.map((e) => (
            <TaskRow key={e.task.id} task={e.task} kind={e.kind} date={selectedDate} />
          ))}
        </section>
      )}

      {isInteractive && isEmpty && (
        <div className={styles.empty}>
          <div className={styles.emptyBig}>{isToday ? "今天還很空白" : "這天還很空白"}</div>
          <div className={styles.emptySub}>從下面加一件最想推進的事吧</div>
        </div>
      )}

      {isInteractive && (
          <AddTaskBar
            placeholder="+ 加一件這天的事…"
            ariaLabel="新增這天的事"
            withMode
            onSubmit={(title, mode) => addTodayTask(title, selectedDate, isAdhocOf(mode ?? "planned"))}
          />
        )}
    </div>
  );
}

function monthShort(iso: string): string {
  const [, m] = iso.split("-").map(Number);
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return names[m - 1];
}
