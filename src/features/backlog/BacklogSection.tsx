import { useState } from "react";
import type { Task } from "@/lib/types";
import { tasksInBacklog } from "@/lib/tasks";
import { BacklogRow } from "./BacklogRow";
import { AddBacklogTaskInput } from "./AddBacklogTaskInput";
import styles from "./BacklogSection.module.css";

export interface BacklogSectionProps {
  allTasks: Task[];
  focusDate: string;
  defaultOpen?: boolean;
}

export function BacklogSection({ allTasks, focusDate, defaultOpen = false }: BacklogSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const items = tasksInBacklog(allTasks);

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
        <span className={styles.count}>({items.length})</span>
        <span className={styles.chevron}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className={styles.list}>
          {items.map((t) => (
            <BacklogRow key={t.id} task={t} focusDate={focusDate} />
          ))}
          {items.length === 0 && <div className={styles.empty}>Backlog 是空的</div>}
          <AddBacklogTaskInput />
        </div>
      )}
    </section>
  );
}
