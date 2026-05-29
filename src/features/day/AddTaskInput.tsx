import { useState } from "react";
import { useTasksStore } from "@/store/tasks";
import styles from "./AddTaskInput.module.css";

export function AddTaskInput() {
  const addTodayTask = useTasksStore((s) => s.addTodayTask);
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim()) {
      setValue("");
      return;
    }
    addTodayTask(value);
    setValue("");
  };

  return (
    <div className={styles.bar}>
      <span className={styles.box} aria-hidden />
      <input
        className={styles.input}
        placeholder="+ 加一件今天的事…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="新增今天的事"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
        }}
      />
    </div>
  );
}
