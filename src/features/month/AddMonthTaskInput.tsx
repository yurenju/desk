import { useState } from "react";
import { useTasksStore } from "@/store/tasks";
import styles from "./AddMonthTaskInput.module.css";

export function AddMonthTaskInput({ month }: { month: string }) {
  const addMonthTask = useTasksStore((s) => s.addMonthTask);
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim()) {
      setValue("");
      return;
    }
    addMonthTask(value, month);
    setValue("");
  };

  return (
    <div className={styles.bar}>
      <span className={styles.box} aria-hidden />
      <input
        className={styles.input}
        placeholder="+ 加一件這個月要做的事…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="新增本月任務"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
        }}
      />
    </div>
  );
}
