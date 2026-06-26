import { useMemo } from "react";
import type { Task } from "@/lib/types";
import { tasksOnDate, byPosition, dailyRankOn } from "@/lib/tasks";
import { dayOfMonth, shortWeekday } from "@/lib/date";
import { useTasksStore } from "@/store/tasks";
import { useDroppableZone } from "@/features/plan-view/useDroppableZone";
import { SortableSection } from "@/features/plan-view/SortableSection";
import { containerId } from "@/features/plan-view/planDrag";
import { useDragOrdering } from "@/features/plan-view/useDragOrdering";
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

  // A moved-out task (forwarded / dismissed) stays in the section it belonged to,
  // greyed with a "moved to where" label, instead of being banished to a separate
  // trail list at the bottom. Sectioning by dailyRankOn(...) and is_adhoc; demoteToMonth
  // preserves the per-date rank entry so it lands back in its Top3 slot on the original date.
  const top3 = entries
    .filter((e) => dailyRankOn(e.task, selectedDate))
    .sort(
      (a, b) =>
        Number(dailyRankOn(a.task, selectedDate)) - Number(dailyRankOn(b.task, selectedDate)),
    );

  const otherPlanned = entries
    .filter((e) => !dailyRankOn(e.task, selectedDate) && e.task.custom_fields.is_adhoc !== "true")
    .sort((a, b) => byPosition(a.task, b.task));

  // Exclude tasks already promoted to Top3 (mirrors otherPlanned) so a
  // prioritised adhoc task isn't rendered in both sections.
  const adhoc = entries
    .filter((e) => !dailyRankOn(e.task, selectedDate) && e.task.custom_fields.is_adhoc === "true")
    .sort((a, b) => byPosition(a.task, b.task));

  // Live drag preview: re-order each section by the DndContext's preview map.
  // `entryById` spans every entry so an overflow preview (which pulls a task from
  // "other" into top3, or pushes top3's 3rd into "other") can resolve entries
  // that aren't in the section's own base list.
  const { previewOrder } = useDragOrdering();
  // Lookup over every entry on the day. Left un-memoized on purpose: the React
  // Compiler handles memoization, and a manual useMemo over the non-memoized
  // arrays trips react-hooks/preserve-manual-memoization.
  const entryById = new Map(entries.map((e) => [`day:${e.task.id}`, e]));
  const orderSection = (cid: string, base: typeof entries): typeof entries => {
    const baseIds = base.map((e) => `day:${e.task.id}`);
    const ids = previewOrder(cid, baseIds);
    return ids.map((id) => entryById.get(id)).filter((e): e is (typeof entries)[number] => Boolean(e));
  };
  const otherCid = containerId({ kind: "other", date: selectedDate });
  const adhocCid = containerId({ kind: "adhoc", date: selectedDate });
  const otherOrdered = orderSection(otherCid, otherPlanned);
  const adhocOrdered = orderSection(adhocCid, adhoc);

  const isEmpty = top3.length === 0 && otherPlanned.length === 0 && adhoc.length === 0;

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
            entries={top3}
            title={isToday ? "今天最重要的三件事" : "最重要的三件事"}
            variant="accent"
            date={selectedDate}
            interactive={isInteractive}
            entryById={entryById}
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
        {otherOrdered.length > 0 && (
          <section className={styles.section}>
            <header className={styles.sectionHead}>
              其他計劃內{" "}
              <span className={styles.count}>
                {otherOrdered.filter((e) => e.kind === "primary").length}
              </span>
            </header>
            <SortableSection
              id={otherCid}
              items={otherOrdered.filter((e) => e.kind === "primary").map((e) => `day:${e.task.id}`)}
            >
              {otherOrdered.map((e) => (
                <TaskRow
                  key={e.task.id}
                  task={e.task}
                  kind={e.kind}
                  date={selectedDate}
                  interactive={isInteractive}
                  showRing={isInteractive}
                />
              ))}
            </SortableSection>
          </section>
        )}

        {adhocOrdered.length > 0 && (
          <section className={styles.section}>
            <header className={[styles.sectionHead, styles.adhocHead].join(" ")}>
              {isToday ? "今天臨時加的" : "臨時加的"}{" "}
              <span className={styles.count}>
                {adhocOrdered.filter((e) => e.kind === "primary").length}
              </span>
            </header>
            <SortableSection
              id={adhocCid}
              items={adhocOrdered.filter((e) => e.kind === "primary").map((e) => `day:${e.task.id}`)}
            >
              {adhocOrdered.map((e) => (
                <TaskRow
                  key={e.task.id}
                  task={e.task}
                  kind={e.kind}
                  date={selectedDate}
                  interactive={isInteractive}
                  showRing={isInteractive}
                />
              ))}
            </SortableSection>
          </section>
        )}

        {isInteractive && otherOrdered.length === 0 && adhocOrdered.length === 0 && otherIsOver && (
          <div className={styles.dropHint}>拖到這裡 → 其他計劃內</div>
        )}
      </div>

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
            onSubmit={(title, mode) => addTodayTask(title, selectedDate, isAdhocOf(mode))}
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
