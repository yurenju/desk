import type { Priority } from "@/lib/types";
import styles from "./PriorityRing.module.css";

export interface PriorityRingProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "value"
> {
  value: Priority | null;
  onClick: () => void;
}

export function PriorityRing({ value, onClick, className, ...rest }: PriorityRingProps) {
  const isSet = value !== null;
  return (
    <button
      type="button"
      className={[styles.ring, isSet ? styles.solid : styles.empty, className]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      aria-label={isSet ? `今日重點第 ${value}` : "設為今日重點"}
      {...rest}
    >
      {isSet ? value : "+"}
    </button>
  );
}
