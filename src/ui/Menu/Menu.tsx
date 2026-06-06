import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ReactElement, ReactNode } from "react";
import styles from "./Menu.module.css";

export interface MenuItemSpec {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export interface MenuProps {
  trigger: ReactNode;
  items: MenuItemSpec[];
  ariaLabel?: string;
  /**
   * When provided, the menu renders as a single-select group: each item becomes a
   * `menuitemradio` and the item whose `key === selectedKey` is announced as checked.
   * Omit for action-mode menus (plain `menuitem`, no selection marker).
   */
  selectedKey?: string;
}

export function Menu({ trigger, items, ariaLabel, selectedKey }: MenuProps) {
  const isSingleSelect = selectedKey !== undefined;
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger as ReactElement} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={4} align="end" className={styles.positioner}>
          <BaseMenu.Popup className={styles.popup} aria-label={ariaLabel}>
            {isSingleSelect ? (
              <BaseMenu.RadioGroup value={selectedKey}>
                {items.map((it) => (
                  <BaseMenu.RadioItem
                    key={it.key}
                    value={it.key}
                    disabled={it.disabled}
                    closeOnClick
                    className={[
                      styles.item,
                      it.danger && styles.danger,
                      it.key === selectedKey && styles.selected,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={it.onSelect}
                  >
                    {it.label}
                  </BaseMenu.RadioItem>
                ))}
              </BaseMenu.RadioGroup>
            ) : (
              items.map((it) => (
                <BaseMenu.Item
                  key={it.key}
                  disabled={it.disabled}
                  className={[styles.item, it.danger && styles.danger]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={it.onSelect}
                >
                  {it.label}
                </BaseMenu.Item>
              ))
            )}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
