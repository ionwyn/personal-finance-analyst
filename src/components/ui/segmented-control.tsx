"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";

import styles from "./segmented-control.module.scss";

export type SegmentOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** Accessible name — supply when `label` is just a glyph. */
  ariaLabel?: string;
};

export type SegmentedControlProps<T extends string> = {
  /** Accessible name for the control group. */
  label: string;
  value: T;
  options: ReadonlyArray<SegmentOption<T>>;
  onChange: (value: T) => void;
  variant?: "default" | "accent";
  size?: "sm" | "md";
};

/**
 * Segmented single-select control built on react-aria's ToggleButtonGroup —
 * arrow-key navigation, roving focus and ARIA handled.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  variant = "default",
  size = "sm",
}: SegmentedControlProps<T>) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const next = [...keys][0];
        if (next != null) onChange(next as T);
      }}
      className={clsx(
        styles.group,
        size === "md" && styles.md,
        variant === "accent" && styles.accent,
      )}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.value}
          id={option.value}
          aria-label={option.ariaLabel}
          className={styles.segment}
        >
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
