import { useState } from "react";
import type { Task } from "@/lib/types";
import { tasksInBacklog, byPosition } from "@/lib/tasks";
import { containerId } from "@/features/plan-view/planDrag";
import { useDragOrdering } from "@/features/plan-view/useDragOrdering";
import { SortableSection } from "@/features/plan-view/SortableSection";
import { BacklogRow } from "./BacklogRow";
import { AddTaskBar } from "@/ui/AddTaskBar";
import { useTasksStore } from "@/store/tasks";
import styles from "./BacklogSection.module.css";

export interface BacklogSectionProps {
  allTasks: Task[];
  focusDate: string;
  defaultOpen?: boolean;
}

export function BacklogSection({ allTasks, focusDate, defaultOpen = false }: BacklogSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const addBacklogTask = useTasksStore((s) => s.addBacklogTask);
  const { previewOrder } = useDragOrdering();

  const baseItems = tasksInBacklog(allTasks).sort((a, b) => byPosition(a, b));
  const poolCid = containerId({ kind: "poolBacklog" });
  const baseIds = baseItems.map((t) => `backlog:${t.id}`);

  // Build a lookup so we can resolve tasks in preview order.
  const taskById = new Map<string, Task>();
  for (const t of baseItems) taskById.set(`backlog:${t.id}`, t);

  const orderedIds = previewOrder(poolCid, baseIds);
  const items = orderedIds.map((id) => taskById.get(id)).filter((t): t is Task => Boolean(t));

  return (
    <section className={styles.root}>
      <button
        type="button"
        className={styles.head}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.icon}>📥</span>
        <span className={styles.label}>Backlog</span>
        <span className={styles.count}>({baseItems.length})</span>
        <span className={styles.chevron}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className={styles.list}>
          {items.length > 0 ? (
            <SortableSection id={poolCid} items={orderedIds}>
              {items.map((t) => (
                <BacklogRow key={t.id} task={t} focusDate={focusDate} />
              ))}
            </SortableSection>
          ) : (
            <div className={styles.empty}>Backlog 是空的</div>
          )}
          <AddTaskBar
              placeholder="+ 加一件想做但還沒排的事…"
              ariaLabel="新增 backlog 任務"
              onSubmit={(title) => addBacklogTask(title)}
            />
        </div>
      )}
    </section>
  );
}
