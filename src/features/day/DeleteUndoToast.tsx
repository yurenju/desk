import { useEffect } from "react";
import { useTasksStore } from "@/store/tasks";
import styles from "./DeleteUndoToast.module.css";

export function DeleteUndoToast() {
  const recentlyDeleted = useTasksStore((s) => s.recentlyDeleted);
  const restoreTask = useTasksStore((s) => s.restoreTask);
  const clear = useTasksStore((s) => s.clearRecentlyDeleted);

  useEffect(() => {
    if (!recentlyDeleted) return;
    const timer = setTimeout(clear, 5000);
    return () => clearTimeout(timer);
  }, [recentlyDeleted, clear]);

  if (!recentlyDeleted) return null;

  return (
    <div className={styles.toast} role="status">
      <span>已刪除「{recentlyDeleted.task.title}」</span>
      <button type="button" className={styles.undo} onClick={restoreTask}>
        復原
      </button>
    </div>
  );
}
