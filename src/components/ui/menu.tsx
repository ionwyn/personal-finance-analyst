"use client";

import type { ReactNode } from "react";
import {
  Button,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Separator,
} from "react-aria-components";

import styles from "./menu.module.scss";

export type MenuItemDef = {
  id: string;
  label: string;
  icon?: ReactNode;
  onAction?: () => void;
  disabled?: boolean;
};

export interface DropdownMenuProps {
  label: string;
  items: MenuItemDef[];
  children: ReactNode;
}

export function DropdownMenu({ label, items, children }: DropdownMenuProps) {
  return (
    <MenuTrigger>
      <Button aria-label={label} className={styles.trigger}>
        {children}
      </Button>
      <Popover className={styles.popover}>
        <Menu
          className={styles.menu}
          onAction={(key) => {
            const item = items.find((i) => i.id === key);
            item?.onAction?.();
          }}
        >
          {items.map((item, idx) => (
            item.id === "__sep__" ? (
              <Separator key={idx} className={styles.separator} />
            ) : (
              <MenuItem
                key={item.id}
                id={item.id}
                isDisabled={item.disabled}
                className={styles.item}
              >
                {item.icon ? <span className={styles.itemIcon}>{item.icon}</span> : null}
                {item.label}
              </MenuItem>
            )
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
