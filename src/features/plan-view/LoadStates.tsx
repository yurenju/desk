import { Button } from "@/ui/Button/Button";
import styles from "./LoadStates.module.css";

/** Shared loading skeleton for the Focus / Plan routes — a few placeholder bars
 * while the first task fetch resolves. */
export function LoadSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <main aria-busy="true" className={styles.skeleton}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.bar} />
      ))}
    </main>
  );
}

/** Shared load-error state for the Focus / Plan routes. */
export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className={styles.error}>
      <p className={styles.errorTitle}>載入任務時出了點問題</p>
      <p className={styles.errorSub}>可能是連線中斷或登入過期,稍等一下再試一次。</p>
      <Button variant="primary" size="sm" onClick={onRetry}>
        重試
      </Button>
    </div>
  );
}
