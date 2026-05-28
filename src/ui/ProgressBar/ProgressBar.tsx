import styles from "./ProgressBar.module.css";

export interface ProgressBarProps {
  value: number;
  variant?: "accent" | "ink";
  ariaLabel?: string;
  className?: string;
}

export function ProgressBar({ value, variant = "accent", ariaLabel, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={[styles.track, className].filter(Boolean).join(" ")}
    >
      <div
        className={[styles.fill, styles[`v_${variant}`]].join(" ")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
