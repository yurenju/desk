import { useRef, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Subtask } from "@/lib/types";
import { Checkbox } from "@/ui/Checkbox";
import styles from "./SubtaskList.module.css";

function InlineTitleEditor({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const done = useRef(false);
  function finish(commit: boolean) {
    if (done.current) return; // single commit path: blur after Enter/Escape is a no-op
    done.current = true;
    const t = draft.trim();
    if (commit && t) onCommit(t);
    else onCancel();
  }
  return (
    <input
      className={styles.editInput}
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) e.currentTarget.blur();
        if (e.key === "Escape") finish(false);
      }}
    />
  );
}

export interface SubtaskListProps {
  subtasks: Subtask[];
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
  onAdd: (title: string) => void;
  onOpen: (id: string) => void;
  onReorder: (activeId: string, overId: string) => void;
}

function SubtaskRow({
  subtask,
  editing,
  onToggle,
  onRename,
  onRemove,
  onOpen,
  onStartEdit,
  onStopEdit,
}: {
  subtask: Subtask;
  editing: boolean;
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
  onOpen: (id: string) => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subtask.id,
  });
  // Same rationale as useSortableRow: no keyboard drag, and the row wraps its
  // own interactive controls, so drop dnd-kit's button role/tabindex.
  const { role, tabIndex, ...safeAttributes } = attributes;
  void role;
  void tabIndex;

  return (
    <div
      ref={setNodeRef}
      data-testid="subtask-row"
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={[
        styles.row,
        subtask.status === "done" && styles.done,
        isDragging && styles.dragging,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className={styles.handle} aria-label="拖曳排序" {...safeAttributes} {...listeners}>
        ⠿
      </span>
      <Checkbox
        checked={subtask.status === "done"}
        onCheckedChange={() => onToggle(subtask.id)}
        aria-label={subtask.title}
      />
      {editing ? (
        <InlineTitleEditor
          initial={subtask.title}
          onCommit={(t) => {
            onRename(subtask.id, t);
            onStopEdit();
          }}
          onCancel={onStopEdit}
        />
      ) : (
        <button type="button" className={styles.title} onClick={onStartEdit}>
          {subtask.title}
        </button>
      )}
      <button
        type="button"
        className={styles.open}
        aria-label="開啟子任務詳情"
        onClick={() => onOpen(subtask.id)}
      >
        ⤢
      </button>
      <button
        type="button"
        className={styles.del}
        aria-label="刪除子任務"
        onClick={() => onRemove(subtask.id)}
      >
        🗑
      </button>
    </div>
  );
}

export function SubtaskList({
  subtasks,
  onToggle,
  onRename,
  onRemove,
  onAdd,
  onOpen,
  onReorder,
}: SubtaskListProps) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const total = subtasks.length;
  const done = subtasks.filter((s) => s.status === "done").length;

  function submitAdd() {
    const t = draft.trim();
    if (!t) return;
    onAdd(t);
    setDraft("");
  }

  function handleDragEnd(e: DragEndEvent) {
    if (e.over && e.active.id !== e.over.id) onReorder(String(e.active.id), String(e.over.id));
  }

  return (
    <div className={styles.wrap}>
      {total > 0 && (
        <div className={styles.progress}>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <span className={styles.count}>{done} / {total}</span>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {subtasks.map((s) => (
            <SubtaskRow
              key={s.id}
              subtask={s}
              editing={editingId === s.id}
              onToggle={onToggle}
              onRename={onRename}
              onRemove={onRemove}
              onOpen={onOpen}
              onStartEdit={() => setEditingId(s.id)}
              onStopEdit={() => setEditingId(null)}
            />
          ))}
        </SortableContext>
      </DndContext>
      <div className={styles.add}>
        <span className={styles.plus}>＋</span>
        <input
          className={styles.addInput}
          placeholder="新增子任務…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submitAdd();
          }}
        />
      </div>
    </div>
  );
}
