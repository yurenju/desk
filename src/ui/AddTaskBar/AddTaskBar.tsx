import { useState } from "react";
import { useEntryMode, type EntryMode } from "@/lib/entryMode";
import { EntryModeChip } from "./EntryModeChip";
import styles from "./AddTaskBar.module.css";

export interface AddTaskBarProps {
  placeholder: string;
  ariaLabel: string;
  withMode?: boolean;
  onSubmit: (title: string, mode?: EntryMode) => void;
}

export function AddTaskBar({ placeholder, ariaLabel, withMode = false, onSubmit }: AddTaskBarProps) {
  const [value, setValue] = useState("");
  const [mode] = useEntryMode();

  const submit = () => {
    if (!value.trim()) {
      setValue("");
      return;
    }
    onSubmit(value, withMode ? mode : undefined);
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
      {withMode && <EntryModeChip />}
    </div>
  );
}
