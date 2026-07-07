import type { Task } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import { Menu } from "@/ui/Menu";
import { RowTitleInput } from "@/ui/RowTitleInput";
import { useSortableRow } from "@/features/plan-view/useSortableRow";
import { SortableSection } from "@/features/plan-view/SortableSection";
import { containerId } from "@/features/plan-view/planDrag";
import { useDragOrdering } from "@/features/plan-view/useDragOrdering";
import { isAdhoc } from "@/lib/tasks";
import { useMonthRow } from "./useMonthRow";
import { MonthPriorityMenu } from "./MonthPriorityMenu";
import { buildMonthRowMenuItems } from "./monthRowMenu";
import styles from "./MonthHeroCard.module.css";

export interface MonthHeroCardProps {
  top3: Task[];
  month: string;
  selectedDate: string;
  /** Lookup spanning top3 + 其他任務 so an overflow preview (which pulls a pool
   *  task into the hero) can resolve a task outside this card's own list. */
  taskById: Map<string, Task>;
}

export function MonthHeroCard({ top3, month, selectedDate, taskById }: MonthHeroCardProps) {
  const { previewOrder } = useDragOrdering();
  const cid = containerId({ kind: "monthTop3", month });
  const baseIds = top3.map((t) => `month:${t.id}`);
  const ordered = previewOrder(cid, baseIds)
    .map((id) => taskById.get(id))
    .filter((t): t is Task => Boolean(t));

  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>本月最重要的三件事</h3>
      <SortableSection id={cid} items={ordered.map((t) => `month:${t.id}`)}>
        <ul className={styles.list}>
          {ordered.map((t, i) => (
            <MonthHeroItem
              key={t.id}
              task={t}
              rank={i + 1}
              month={month}
              selectedDate={selectedDate}
            />
          ))}
        </ul>
      </SortableSection>
    </div>
  );
}

function MonthHeroItem({
  task,
  rank,
  month,
  selectedDate,
}: {
  task: Task;
  rank: number;
  month: string;
  selectedDate: string;
}) {
  const row = useMonthRow(task.id, { month, selectedDate });
  const { ref: dragRef, isDragging, handleProps, style } = useSortableRow(`month:${task.id}`);
  const adhoc = isAdhoc(task);
  // Ring shows the previewed render position (live ①②③ reflow), not the stored
  // monthly_priority — so dropping reflows the numbers before commit.
  const pr = String(rank) as "1" | "2" | "3";

  return (
    <li
      ref={dragRef}
      style={style}
      className={[styles.item, isDragging && styles.dragging].filter(Boolean).join(" ")}
      {...handleProps}
    >
      <Checkbox
        checked={task.status === "done"}
        onCheckedChange={row.toggle}
        aria-label={task.title}
      />
      <MonthPriorityMenu value={pr} onSelect={row.setPriority} />
      <div className={styles.itemBody}>
        {row.isEditing ? (
          <RowTitleInput
            draft={row.draft}
            onChangeDraft={row.changeDraft}
            onCommit={row.commitEdit}
            onCancel={row.cancelEdit}
          />
        ) : (
          <div className={styles.itemTitle}>{task.title}</div>
        )}
      </div>
      {adhoc && <UnplannedChip />}
      {!row.isEditing && (
        <div className={styles.actions}>
          <Menu
            ariaLabel="更多動作"
            trigger={
              <button type="button" className={styles.iconBtn} aria-label="更多動作">
                ⋯
              </button>
            }
            items={buildMonthRowMenuItems({ task, selectedDate, row })}
          />
        </div>
      )}
    </li>
  );
}
