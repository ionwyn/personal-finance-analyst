"use client";

import { X } from "lucide-react";
import { parseDate } from "@internationalized/date";
import {
  Button,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DateRangePicker as AriaDateRangePicker,
  DateSegment,
  Dialog,
  Heading,
  Popover,
  RangeCalendar,
} from "react-aria-components";

import styles from "./date-range-picker.module.scss";

export interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const startDate = from ? tryParseDate(from) : null;
  const endDate = to ? tryParseDate(to) : null;
  const value = startDate && endDate ? { start: startDate, end: endDate } : null;
  const hasDates = Boolean(from || to);

  return (
    <AriaDateRangePicker
      aria-label="Date range"
      value={value}
      onChange={(range) => {
        const f = range?.start?.toString() ?? "";
        const t = range?.end?.toString() ?? "";
        onChange(f, t);
      }}
      className={styles.picker}
    >
      <Button className={styles.group}>
        <span className={styles.calBtn} aria-hidden>
          <CalIconSvg />
        </span>
        <DateInput slot="start" className={styles.dateInput}>
          {(seg) => <DateSegment segment={seg} className={styles.segment} />}
        </DateInput>
        <span className={styles.sep} aria-hidden>
          →
        </span>
        <DateInput slot="end" className={styles.dateInput}>
          {(seg) => <DateSegment segment={seg} className={styles.segment} />}
        </DateInput>
        {hasDates ? (
          <button
            type="button"
            aria-label="Clear date range"
            className={styles.clearBtn}
            onClick={(e) => {
              e.stopPropagation();
              onChange("", "");
            }}
          >
            <X size={11} />
          </button>
        ) : null}
      </Button>
      <Popover className={styles.popover}>
        <Dialog className={styles.dialog}>
          <RangeCalendar className={styles.calendar}>
            <header className={styles.calHeader}>
              <Button slot="previous" className={styles.navBtn}>
                ‹
              </Button>
              <Heading className={styles.heading} />
              <Button slot="next" className={styles.navBtn}>
                ›
              </Button>
            </header>
            <CalendarGrid className={styles.calGrid}>
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className={styles.dayName}>{day}</CalendarHeaderCell>
                )}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => <CalendarCell date={date} className={styles.cell} />}
              </CalendarGridBody>
            </CalendarGrid>
          </RangeCalendar>
        </Dialog>
      </Popover>
    </AriaDateRangePicker>
  );
}

function tryParseDate(s: string) {
  try {
    return parseDate(s);
  } catch {
    return null;
  }
}

function CalIconSvg() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
