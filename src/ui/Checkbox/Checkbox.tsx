import { forwardRef } from "react";
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import styles from "./Checkbox.module.css";

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  variant?: "primary" | "accent";
  className?: string;
  "aria-label"?: string;
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { variant = "primary", className, ...rest },
  ref,
) {
  return (
    <BaseCheckbox.Root
      ref={ref}
      className={[styles.root, styles[`v_${variant}`], className].filter(Boolean).join(" ")}
      {...rest}
    >
      <BaseCheckbox.Indicator className={styles.indicator}>
        <span className={styles.mark}>✓</span>
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
});
