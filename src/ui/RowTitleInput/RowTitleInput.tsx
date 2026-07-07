import styles from "./RowTitleInput.module.css";

/**
 * Inline title-edit input shared by all task rows (day / backlog / month / hero).
 * Encapsulates the edit-mode wiring that must stay identical everywhere:
 * autoFocus, blur-to-cancel, Enter-to-commit (guarded against IME composition),
 * Escape-to-cancel.
 */
export function RowTitleInput({
  draft,
  onChangeDraft,
  onCommit,
  onCancel,
}: {
  draft: string;
  onChangeDraft: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      className={styles.editInput}
      autoFocus
      value={draft}
      onChange={(e) => onChangeDraft(e.target.value)}
      onBlur={onCancel}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) onCommit();
        if (e.key === "Escape") onCancel();
      }}
    />
  );
}
