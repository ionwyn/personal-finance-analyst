"use client";

import type { ReactNode } from "react";
import { Switch as AriaSwitch } from "react-aria-components";

import styles from "./switch.module.scss";

export type SwitchProps = {
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
  /** Visible label text. */
  children: ReactNode;
};

/** Toggle switch built on react-aria's Switch — keyboard, focus and ARIA handled. */
export function Switch({ isSelected, onChange, children }: SwitchProps) {
  return (
    <AriaSwitch isSelected={isSelected} onChange={onChange} className={styles.switch}>
      <span className={styles.track} />
      {children}
    </AriaSwitch>
  );
}
