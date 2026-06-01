import { useEffect } from "react";
import { useTasksStore } from "@/store/tasks";
import styles from "./DeleteUndoToast.module.css";

export function DeleteUndoToast() {
  const recentlyDeleted = useTasksStore((s) => s.recentlyDeleted);
  const restoreTask = useTasksStore((s) => s.restoreTask);
  const clearRecentlyDeleted = useTasksStore((s) => s.clearRecentlyDeleted);
  const error = useTasksStore((s) => s.error);
  const clearError = useTasksStore((s) => s.clearError);

  useEffect(() => {
    if (!recentlyDeleted) return;
    const timer = setTimeout(clearRecentlyDeleted, 5000);
    return () => clearTimeout(timer);
  }, [recentlyDeleted, clearRecentlyDeleted]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clearError, 4000);
    return () => clearTimeout(timer);
  }, [error, clearError]);

  if (recentlyDeleted) {
    return (
      <div className={styles.toast} role="status">
        <span>已刪除「{recentlyDeleted.task.title}」</span>
        <button type="button" className={styles.undo} onClick={restoreTask}>
          復原
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.toast} role="alert">
        <span>儲存失敗，請再試一次</span>
      </div>
    );
  }

  return null;
}
