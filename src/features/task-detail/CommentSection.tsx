import { useRef, useState } from "react";
import type { TaskComment } from "@/lib/types";
import { relativeTime } from "@/lib/date";
import styles from "./CommentSection.module.css";

function CommentEditor({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (content: string) => void;
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
    <textarea
      className={styles.editArea}
      aria-label="編輯留言內容"
      autoFocus
      rows={2}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") finish(false);
      }}
    />
  );
}

export interface CommentSectionProps {
  comments: TaskComment[];
  status: "loading" | "ready" | "error";
  onAdd: (content: string) => void;
  onEdit: (id: string, content: string) => void;
  onRemove: (id: string) => void;
}

export function CommentSection({ comments, status, onAdd, onEdit, onRemove }: CommentSectionProps) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  function submitAdd() {
    const t = draft.trim();
    if (!t) return;
    onAdd(t);
    setDraft("");
  }

  if (status === "loading") return <p className={styles.muted}>載入中…</p>;
  if (status === "error") return <p className={styles.muted}>留言載入失敗</p>;

  return (
    <div className={styles.wrap}>
      {comments.map((c) => (
        <div key={c.id} className={styles.row}>
          {editingId === c.id ? (
            <CommentEditor
              initial={c.content}
              onCommit={(t) => { onEdit(c.id, t); setEditingId(null); }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <>
              <div className={styles.content}>{c.content}</div>
              <div className={styles.meta}>
                <span className={styles.time}>
                  {relativeTime(c.updated_at)}
                  {c.updated_at !== c.created_at && "（已編輯）"}
                </span>
                <button
                  type="button"
                  className={styles.action}
                  aria-label="編輯留言"
                  onClick={() => setEditingId(c.id)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className={styles.action}
                  aria-label="刪除留言"
                  onClick={() => onRemove(c.id)}
                >
                  🗑
                </button>
              </div>
            </>
          )}
        </div>
      ))}
      <div className={styles.add}>
        <textarea
          className={styles.addInput}
          placeholder="新增留言…"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submitAdd();
            }
          }}
        />
        <button type="button" className={styles.send} aria-label="送出留言" onClick={submitAdd}>
          送出
        </button>
      </div>
    </div>
  );
}
