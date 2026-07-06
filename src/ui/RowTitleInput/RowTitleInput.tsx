/**
 * Inline title-edit input shared by all task rows (day / backlog / month / hero).
 * Encapsulates the edit-mode wiring that must stay identical everywhere:
 * autoFocus, blur-to-cancel, Enter-to-commit (guarded against IME composition),
 * Escape-to-cancel. Styling stays with the caller via className.
 */
export function RowTitleInput({
  className,
  draft,
  onChangeDraft,
  onCommit,
  onCancel,
}: {
  className?: string;
  draft: string;
  onChangeDraft: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      className={className}
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
