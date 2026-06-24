import type { Task } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import { Menu } from "@/ui/Menu";
import { PriorityRing } from "@/ui/PriorityRing";
import { useSortableRow } from "@/features/plan-view/useSortableRow";
import { SortableSection } from "@/features/plan-view/SortableSection";
import { containerId } from "@/features/plan-view/planDrag";
import { useDragOrdering } from "@/features/plan-view/useDragOrdering";
import { useMonthRow } from "./useMonthRow";
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
  const isAdhoc = task.custom_fields.is_adhoc === "true";
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
      <Menu
        ariaLabel="本月重點"
        selectedKey={pr}
        trigger={<PriorityRing value={pr} aria-label={`本月重點第 ${pr}`} />}
        items={[
          { key: "1", label: "① 本月第一", onSelect: () => row.setPriority("1") },
          { key: "2", label: "② 本月第二", onSelect: () => row.setPriority("2") },
          { key: "3", label: "③ 本月第三", onSelect: () => row.setPriority("3") },
          { key: "none", label: "— 移除重點", onSelect: () => row.setPriority(null) },
        ]}
      />
      <div className={styles.itemBody}>
        {row.isEditing ? (
          <input
            className={styles.editInput}
            autoFocus
            value={row.draft}
            onChange={(e) => row.changeDraft(e.target.value)}
            onBlur={row.cancelEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) row.commitEdit();
              if (e.key === "Escape") row.cancelEdit();
            }}
          />
        ) : (
          <div className={styles.itemTitle}>{task.title}</div>
        )}
      </div>
      {isAdhoc && <UnplannedChip />}
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
