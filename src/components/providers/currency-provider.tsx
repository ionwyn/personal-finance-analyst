"use client";

import { createContext, useContext, type ReactNode } from "react";

export type DisplayCurrency = "CAD" | "USD";

type CurrencyState = {
  /** Active display currency. */
  currency: DisplayCurrency;
  /** Multiplier from base (CAD) amounts to the display currency. */
  rate: number;
};

const CurrencyContext = createContext<CurrencyState>({ currency: "CAD", rate: 1 });

export function CurrencyProvider({
  currency,
  rate,
  children,
}: CurrencyState & { children: ReactNode }) {
  return <CurrencyContext.Provider value={{ currency, rate }}>{children}</CurrencyContext.Provider>;
}

/**
 * The active display currency + base→display rate. Amounts are converted at the
 * data-loading layer (server), so this is for the currency *indicator* (and any
 * future client-only conversions) — don't re-scale already-converted loader data.
 */
export function useCurrency() {
  return useContext(CurrencyContext);
}
