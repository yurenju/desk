import { forwardRef, type ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "ghost", size = "md", className, children, ...rest },
  ref,
) {
  const cls = [styles.btn, styles[`v_${variant}`], styles[`s_${size}`], className]
    .filter(Boolean)
    .join(" ");
  return (
    <button ref={ref} className={cls} {...rest}>
      {children}
    </button>
  );
});
