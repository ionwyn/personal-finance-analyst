"use client";

import clsx from "clsx";
import { Plus, X } from "lucide-react";
import { Button, ListBox, ListBoxItem, Popover, Select } from "react-aria-components";

import styles from "./select.module.scss";

export type FilterSelectProps = {
  /** Label / accessible name for the filter. */
  label: string;
  /** Currently selected value, or null when unset. */
  value: string | null;
  /** Available options. */
  options: string[];
  /** Optional per-option colour dot, keyed by option. */
  dotMap?: Record<string, string>;
  onChange: (value: string | null) => void;
};

/**
 * Accessible filter dropdown built on react-aria's Select. Keeps the
 * dashed filter-pill look, with keyboard navigation, typeahead, and a
 * clear affordance when a value is set.
 */
export function FilterSelect({ label, value, options, dotMap, onChange }: FilterSelectProps) {
  return (
    <Select
      aria-label={label}
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key))}
    >
      <div className={clsx(styles.field, value && styles.active)}>
        <Button className={styles.trigger}>
          <Plus size={12} />
          {label}
          {value ? (
            <>
              <span className={styles.colon}>:</span>
              <span className={styles.value}>{value}</span>
            </>
          ) : null}
        </Button>
        {value ? (
          <button
            type="button"
            className={styles.clear}
            aria-label={`Clear ${label} filter`}
            onClick={() => onChange(null)}
          >
            <X size={12} />
          </button>
        ) : null}
      </div>
      <Popover className={styles.popover}>
        <ListBox
          className={styles.listbox}
          aria-label={`${label} options`}
          renderEmptyState={() => <div className={styles.empty}>No options</div>}
        >
          {options.map((option) => (
            <ListBoxItem key={option} id={option} textValue={option} className={styles.item}>
              {dotMap?.[option] ? (
                <i className={styles.dot} style={{ background: dotMap[option] }} />
              ) : null}
              {option}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
