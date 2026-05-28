import styles from "./PaperTexture.module.css";

export interface PaperTextureProps {
  opacity?: number;
  className?: string;
}

export function PaperTexture({ opacity = 0.4, className }: PaperTextureProps) {
  return (
    <svg
      aria-hidden
      className={[styles.overlay, className].filter(Boolean).join(" ")}
      style={{ opacity }}
    >
      <filter id="paper-noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.08 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#paper-noise)" />
    </svg>
  );
}
