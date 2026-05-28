import styles from "./DeskLogo.module.css";

export interface DeskLogoProps {
  showWordmark?: boolean;
  size?: "sm" | "md";
  className?: string;
}

// Brand mark colors: treated as logo asset, NOT a themed UI element. The
// notebook should always read as paper + ink + red binding regardless of
// light/dark theme, so we don't reference --color-paper / --color-ink (which
// invert with theme) and instead lock to the cream-paper palette.
const BRAND_PAPER = "oklch(0.965 0.018 78)";
const BRAND_INK = "oklch(0.24 0.018 50)";
const BRAND_FLAG = "oklch(0.58 0.18 32)";

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
    <svg width="22" height="26" viewBox="0 0 22 26" fill="none" aria-hidden className={className}>
      <rect
        x="3"
        y="2"
        width="18"
        height="22"
        rx="1.5"
        fill={BRAND_PAPER}
        stroke={BRAND_INK}
        strokeWidth="1.5"
      />
      <line x1="3" y1="2" x2="3" y2="24" stroke={BRAND_FLAG} strokeWidth="2" />
      <circle cx="3" cy="6" r="1" fill={BRAND_PAPER} stroke={BRAND_INK} strokeWidth="0.8" />
      <circle cx="3" cy="13" r="1" fill={BRAND_PAPER} stroke={BRAND_INK} strokeWidth="0.8" />
      <circle cx="3" cy="20" r="1" fill={BRAND_PAPER} stroke={BRAND_INK} strokeWidth="0.8" />
    </svg>
  );
}
