import { useState } from "react";
import { useEntryMode, type EntryMode } from "@/lib/entryMode";
import { EntryModeChip } from "./EntryModeChip";
import styles from "./AddTaskBar.module.css";

export type AddTaskBarProps = {
  placeholder: string;
  ariaLabel: string;
} & (
  | { withMode: true; onSubmit: (title: string, mode: EntryMode) => void }
  | { withMode?: false; onSubmit: (title: string) => void }
);

export function AddTaskBar(props: AddTaskBarProps) {
  const { placeholder, ariaLabel } = props;
  const [value, setValue] = useState("");
  const [mode] = useEntryMode();

  const submit = () => {
    if (!value.trim()) {
      setValue("");
      return;
    }
    if (props.withMode) props.onSubmit(value, mode);
    else props.onSubmit(value);
    setValue("");
  };

  return (
    <div className={styles.bar}>
      <span className={styles.box} aria-hidden />
      <input
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={ariaLabel}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
        }}
      />
      {props.withMode && <EntryModeChip />}
    </div>
  );
}
