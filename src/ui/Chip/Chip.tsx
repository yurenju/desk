import type { ReactNode } from "react";
import styles from "./Chip.module.css";

export interface ChipProps {
  variant: "unplanned" | "plannedRef" | "neutral";
  children: ReactNode;
  className?: string;
}

export function Chip({ variant, children, className }: ChipProps) {
  return (
    <span
      className={[styles.chip, styles[`v_${variant}`], className].filter(Boolean).join(" ")}
    >
      {children}
    </span>
  );
}

export function UnplannedChip({ label = "+ 計劃外" }: { label?: string } = {}) {
  return <Chip variant="unplanned">{label}</Chip>;
}

export function PlannedRefChip({ order }: { order: "1" | "2" | "3" }) {
  return <Chip variant="plannedRef">{order}</Chip>;
}
