import styles from "./CarryoverBanner.module.css";

export interface CarryoverBannerProps {
  fromLabel: string;
  summary: string;
  count: number;
  actions: [string, string, string];
}

export function CarryoverBanner({ fromLabel, summary, count, actions }: CarryoverBannerProps) {
  return (
    <div className={styles.root}>
      <div className={styles.icon} aria-hidden>
        ↩
      </div>
      <div className={styles.body}>
        <div className={styles.meta}>
          {fromLabel} · <strong>{count} 件待處理</strong>
        </div>
        <div className={styles.summary}>{summary}</div>
      </div>
      <div className={styles.actions}>
        {actions.map((a, i) => (
          <button key={i} type="button" className={styles.action} disabled>
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}
