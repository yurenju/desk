import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./DescriptionEditor.module.css";

export interface DescriptionEditorProps {
  value: string;
  onSave: (text: string) => void;
}

export function DescriptionEditor({ value, onSave }: DescriptionEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function startEdit() {
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (draft !== value) onSave(draft);
  }

  if (editing) {
    return (
      <textarea
        className={styles.editor}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        aria-label="編輯描述"
      />
    );
  }

  return (
    <div className={styles.view}>
      <button type="button" className={styles.editBtn} aria-label="編輯描述" onClick={startEdit}>
        ✎ 編輯
      </button>
      {value ? (
        <div className={styles.markdown}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
        </div>
      ) : (
        <button type="button" className={styles.placeholder} onClick={startEdit}>
          加上描述…
        </button>
      )}
    </div>
  );
}
