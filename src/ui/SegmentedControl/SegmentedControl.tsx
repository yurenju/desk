import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle } from "@base-ui/react/toggle";
import type { ReactNode } from "react";
import styles from "./SegmentedControl.module.css";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (v: T) => void;
  options: SegmentedControlOption<T>[];
  size?: "sm" | "md";
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  size = "md",
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(values: string[]) => {
        const next = values[0];
        if (next && next !== value) onValueChange(next as T);
      }}
      aria-label={ariaLabel}
      className={[styles.root, styles[`s_${size}`], className].filter(Boolean).join(" ")}
    >
      {options.map((opt) => (
        <Toggle key={opt.value} value={opt.value} className={styles.item}>
          {opt.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
