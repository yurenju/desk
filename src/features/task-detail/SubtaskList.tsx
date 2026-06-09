import { useRef, useState } from "react";
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
}

export function SubtaskList({ subtasks, onToggle, onRename, onRemove, onAdd }: SubtaskListProps) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const total = subtasks.length;
  const done = subtasks.filter((s) => s.status === "done").length;

  function submitAdd() {
    const t = draft.trim();
    if (!t) return;
    onAdd(t);
    setDraft("");
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
      {subtasks.map((s) => (
        <div key={s.id} className={[styles.row, s.status === "done" && styles.done].filter(Boolean).join(" ")}>
          <Checkbox checked={s.status === "done"} onCheckedChange={() => onToggle(s.id)} aria-label={s.title} />
          {editingId === s.id ? (
            <InlineTitleEditor
              initial={s.title}
              onCommit={(t) => { onRename(s.id, t); setEditingId(null); }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <button
              type="button"
              className={styles.title}
              onClick={() => setEditingId(s.id)}
            >
              {s.title}
            </button>
          )}
          <button type="button" className={styles.del} aria-label="刪除子任務" onClick={() => onRemove(s.id)}>
            🗑
          </button>
        </div>
      ))}
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
