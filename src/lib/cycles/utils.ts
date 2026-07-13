import type { Frequency } from "@/lib/cycles/types";

/**
 * A recurring-expense candidate surfaced in the discovery panel. Sourced from
 * Plaid's recurring streams (see `recurring-candidates.ts`); the optional fields
 * carry the Plaid stream linkage and signals used on confirm.
 */
export type DiscoveryCandidate = {
  key: string;
  sampleMerchant: string;
  suggestedName: string;
  occurrences: number;
  medianIntervalDays: number;
  medianAmount: number;
  frequency: Frequency;
  accrualPerCycle: number;
  lastSeen: string;
  /** Where this candidate came from. */
  source?: "plaid" | "local";
  /** Explicit merchant substring for auto-matching; falls back to `key` when unset. */
  merchantPattern?: string;
  /** Plaid stream linkage + signals (only set when source === "plaid"). */
  plaidStreamId?: string;
  plaidStatus?: string;
  frequencyRaw?: string;
  predictedNextDate?: string | null;
  /** YYYY-MM-DD due date derived from Plaid's predicted next date, prefilled on confirm. */
  nextDueDate?: string | null;
  /** How many times this merchant appears in the user's own 6-month history. */
  localOccurrences?: number;
};

/**
 * Normalize a merchant name for grouping: uppercase, collapse whitespace, strip
 * trailing `#nnn` style suffixes, and drop standalone digit tokens (store IDs,
 * card-last-4 echoes, etc.) so two visits to the same merchant cluster.
 */
export function normalizeMerchant(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.toUpperCase().trim();
  s = s.replace(/#\s*\d+\b/g, " ");
  s = s.replace(/\b\d{2,}\b/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
