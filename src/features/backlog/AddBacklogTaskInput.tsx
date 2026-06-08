import { useState } from "react";
import { useTasksStore } from "@/store/tasks";
import styles from "./AddBacklogTaskInput.module.css";

export function AddBacklogTaskInput() {
  const addBacklogTask = useTasksStore((s) => s.addBacklogTask);
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim()) {
      setValue("");
      return;
    }
    addBacklogTask(value);
    setValue("");
  };

  return (
    <div className={styles.bar}>
      <span className={styles.box} aria-hidden />
      <input
        className={styles.input}
        placeholder="+ 加一件想做但還沒排的事…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="新增 backlog 任務"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
        }}
      />
    </div>
  );
}
