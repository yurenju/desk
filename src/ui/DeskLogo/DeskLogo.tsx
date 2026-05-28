import styles from "./DeskLogo.module.css";

export interface DeskLogoProps {
  showWordmark?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function DeskLogo({ showWordmark = true, size = "md", className }: DeskLogoProps) {
  return (
    <div className={[styles.root, styles[`s_${size}`], className].filter(Boolean).join(" ")}>
      <NotebookMark className={styles.mark} />
      {showWordmark && <span className={styles.wordmark}>desk</span>}
    </div>
  );
}

function NotebookMark({ className }: { className?: string }) {
  return (
    <svg
      width="22"
      height="26"
      viewBox="0 0 22 26"
      fill="none"
      aria-hidden
      className={className}
    >
      <rect x="3" y="2" width="18" height="22" rx="1.5" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="1.5" />
      <line x1="3" y1="2" x2="3" y2="24" stroke="var(--color-flag)" strokeWidth="2" />
      <circle cx="3" cy="6" r="1" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="0.8" />
      <circle cx="3" cy="13" r="1" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="0.8" />
      <circle cx="3" cy="20" r="1" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="0.8" />
    </svg>
  );
}
