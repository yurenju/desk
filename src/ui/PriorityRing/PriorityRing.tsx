import { forwardRef, type ButtonHTMLAttributes } from "react";
import type { Priority } from "@/lib/types";
import styles from "./PriorityRing.module.css";

export interface PriorityRingProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  value: Priority | null;
}

export const PriorityRing = forwardRef<HTMLButtonElement, PriorityRingProps>(
  function PriorityRing({ value, className, ...rest }, ref) {
    const isSet = value !== null;
    return (
      <button
        ref={ref}
        type="button"
        className={[styles.ring, isSet ? styles.solid : styles.empty, className]
          .filter(Boolean)
          .join(" ")}
        aria-label={isSet ? `今日重點第 ${value}` : "設為今日重點"}
        {...rest}
      >
        {isSet ? value : "+"}
      </button>
    );
  },
);
