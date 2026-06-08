import type { Task } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import { UnplannedChip } from "@/ui/Chip";
import { Menu } from "@/ui/Menu";
import { PriorityRing } from "@/ui/PriorityRing";
import { useDraggableRow } from "@/features/plan-view/useDraggableRow";
import { useMonthRow } from "./useMonthRow";
import styles from "./MonthHeroCard.module.css";

export interface MonthHeroCardProps {
  top3: Task[];
  month: string;
  selectedDate: string;
}

export function MonthHeroCard({ top3, month, selectedDate }: MonthHeroCardProps) {
  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>本月最重要的三件事</h3>
      <ul className={styles.list}>
        {top3.map((t) => (
          <MonthHeroItem key={t.id} task={t} month={month} selectedDate={selectedDate} />
        ))}
      </ul>
    </div>
  );
}

function MonthHeroItem({
  task,
  month,
  selectedDate,
}: {
  task: Task;
  month: string;
  selectedDate: string;
}) {
  const row = useMonthRow(task.id, { month, selectedDate });
  const { ref: dragRef, isDragging, handleProps } = useDraggableRow(`month:${task.id}`);
  const isAdhoc = task.custom_fields.is_adhoc === "true";
  const pr = task.custom_fields.monthly_priority ?? null;

  return (
    <li
      ref={dragRef}
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
        selectedKey={pr ?? "none"}
        trigger={<PriorityRing value={pr} aria-label={pr ? `本月重點第 ${pr}` : "設為本月重點"} />}
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
            items={[
              {
                key: "promote-1",
                label: `→ ${selectedDate.slice(8)} 日 · ① 三件事`,
                onSelect: () => row.promote("1"),
              },
              {
                key: "promote-2",
                label: `→ ${selectedDate.slice(8)} 日 · ② 三件事`,
                onSelect: () => row.promote("2"),
              },
              {
                key: "promote-3",
                label: `→ ${selectedDate.slice(8)} 日 · ③ 三件事`,
                onSelect: () => row.promote("3"),
              },
              {
                key: "promote-other",
                label: `→ ${selectedDate.slice(8)} 日 · 其他`,
                onSelect: () => row.promote(),
              },
              isAdhoc
                ? { key: "to-planned", label: "↑ 移到計畫內", onSelect: row.toggleAdhoc }
                : { key: "to-adhoc", label: "↓ 標為計畫外", onSelect: row.toggleAdhoc },
              { key: "edit", label: "編輯", onSelect: () => row.startEdit(task.title) },
              { key: "delete", label: "刪除", onSelect: row.remove, danger: true },
            ]}
          />
        </div>
      )}
    </li>
  );
}
