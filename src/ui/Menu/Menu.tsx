import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ReactElement, ReactNode } from "react";
import styles from "./Menu.module.css";

export interface MenuItemSpec {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  selected?: boolean;
  danger?: boolean;
}

export interface MenuProps {
  trigger: ReactNode;
  items: MenuItemSpec[];
  ariaLabel?: string;
}

export function Menu({ trigger, items, ariaLabel }: MenuProps) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger as ReactElement} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={4} align="end" className={styles.positioner}>
          <BaseMenu.Popup className={styles.popup} aria-label={ariaLabel}>
            {items.map((it) => (
              <BaseMenu.Item
                key={it.key}
                disabled={it.disabled}
                aria-checked={it.selected ? "true" : undefined}
                className={[styles.item, it.danger && styles.danger, it.selected && styles.selected]
                  .filter(Boolean)
                  .join(" ")}
                onClick={it.onSelect}
              >
                {it.label}
              </BaseMenu.Item>
            ))}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
