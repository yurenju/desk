import { useTasksStore } from "@/store/tasks";
import styles from "./SyncBadge.module.css";

// Shown when the on-screen data is not in sync with the server (background
// revalidate failed while a cache is present). Clears on the next successful sync.
export function SyncBadge() {
  const synced = useTasksStore((s) => s.synced);
  if (synced) return null;
  return (
    <span className={styles.badge} role="status" title="資料未與伺服器同步">
      未同步
    </span>
  );
}
