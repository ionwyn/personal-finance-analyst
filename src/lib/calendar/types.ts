// ─── Workspace Calendar: core types ────────────────────────────────────────
// The calendar is a projection/aggregation layer. Events are computed in memory
// from existing app data + cached external sources; they are never persisted as
// rows (only external fetches and user preferences are persisted elsewhere).

export type CalendarCategory =
  | "personal-finance"
  | "investments"
  | "filings"
  | "macro-us"
  | "macro-ca"
  | "tax";

/** How confident we are in a date.
 *  - confirmed: a real, dated fact (a paycheck rule, a posted transaction, a statutory date)
 *  - scheduled: an officially published forward date (FRED release, FOMC/BoC schedule)
 *  - estimated: a provider's best guess (e.g. Yahoo next-earnings)
 *  - window:    a date range, not a single day (tax-slip availability) */
export type CalendarConfidence = "confirmed" | "scheduled" | "estimated" | "window";

export type CalendarEvent = {
  /** Stable natural key, e.g. "bill:<id>", "earnings:AAPL", "macro-us:fred-cpi:2026-09-11".
   *  Used both for React keys and for per-item hiding in calendar preferences. */
  id: string;
  /** YYYY-MM-DD (UTC day). */
  date: string;
  /** Inclusive end of a window event (YYYY-MM-DD); omitted for single-day events. */
  endDate?: string;
  category: CalendarCategory;
  /** Sub-kind within a category, e.g. "paycheck" | "bill" | "earnings" | "fred-cpi". */
  type: string;
  title: string;
  subtitle?: string;
  symbol?: string;
  amount?: number;
  currency?: string;
  confidence: CalendarConfidence;
  /** True when `date` is strictly before today. Computed by the aggregator. */
  isPast: boolean;
  /** Short attribution shown in the day detail / footer. */
  source: string;
};

/** A manageable item exposed to the Calendar settings UI: real bills/goals/holdings
 *  for app-owned sources, or fixed event-types for rule/config sources. */
export type CalendarItem = {
  /** Matches the prefix of the events this item produces, used to build hidden keys. */
  key: string;
  label: string;
};

/** Inclusive fetch window, as UTC YYYY-MM-DD strings. */
export type CalendarRange = {
  start: string;
  end: string;
};

export type CalendarSourceContext = {
  tenantId: string;
  range: CalendarRange;
  /** "Now" for isPast / projection anchoring (injectable for tests). */
  now: Date;
};

export type CalendarSource = {
  /** Unique source id, e.g. "paychecks", "earnings-dividends", "fred-releases". */
  id: string;
  category: CalendarCategory;
  /** Human label for attribution / settings grouping. */
  label: string;
  getEvents(ctx: CalendarSourceContext): Promise<CalendarEvent[]>;
  /** Optional: items a user can individually hide within this category. */
  listItems?(ctx: CalendarSourceContext): Promise<CalendarItem[]>;
};

export const CALENDAR_CATEGORIES: CalendarCategory[] = [
  "personal-finance",
  "investments",
  "filings",
  "macro-us",
  "macro-ca",
  "tax",
];

/** Category metadata: label, the CSS color token used for its dot/accent, and
 *  whether it is shown by default in the on-page filter (only Personal Finance). */
export const CATEGORY_META: Record<
  CalendarCategory,
  { label: string; short: string; colorVar: string; defaultVisible: boolean }
> = {
  "personal-finance": {
    label: "Personal Finance",
    short: "Finance",
    colorVar: "--accent",
    defaultVisible: true,
  },
  investments: { label: "Investments", short: "Invest", colorVar: "--pos", defaultVisible: false },
  filings: { label: "Filings", short: "Filings", colorVar: "--info", defaultVisible: false },
  "macro-us": { label: "Macro · US", short: "US", colorVar: "--cat-3", defaultVisible: false },
  "macro-ca": { label: "Macro · Canada", short: "CA", colorVar: "--cat-5", defaultVisible: false },
  tax: { label: "Tax", short: "Tax", colorVar: "--warn", defaultVisible: false },
};
