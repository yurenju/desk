import type { Priority } from "@/lib/types";
import styles from "./PriorityRing.module.css";

export interface PriorityRingProps {
  value: Priority | null;
  onClick: () => void;
  disabled?: boolean;
}

export function PriorityRing({ value, onClick, disabled }: PriorityRingProps) {
  const isSet = value !== null;
  return (
    <button
      type="button"
      className={[styles.ring, isSet ? styles.solid : styles.empty].join(" ")}
      onClick={onClick}
      disabled={disabled}
      aria-label={isSet ? `今日重點第 ${value}` : "設為今日重點"}
    >
      {isSet ? value : "+"}
    </button>
  );
}
