/**
 * Default landing-page preference (Settings → Display & Preferences).
 * Keys are stored on `UserSettings.defaultLanding`; paths are where the user
 * is sent after login. Shared by the API validator, the Display section
 * select, and the `/app` redirect so the set stays in one place.
 */
export const LANDING_OPTIONS = [
  { value: "dashboard", label: "Dashboard", path: "/app" },
  { value: "accounts", label: "Accounts", path: "/app/accounts" },
  { value: "transactions", label: "Transactions", path: "/app/transactions" },
  { value: "spending-insight", label: "Spending Insight", path: "/app/spending-insight" },
  { value: "investments", label: "Investments", path: "/app/investments" },
  { value: "cycles", label: "Pay cycles", path: "/app/cycles" },
  { value: "budgets", label: "Budgets & Goals", path: "/app/budgets" },
] as const;

export type LandingValue = (typeof LANDING_OPTIONS)[number]["value"];
export type LandingPath = (typeof LANDING_OPTIONS)[number]["path"];

export const LANDING_VALUES = LANDING_OPTIONS.map((o) => o.value) as [
  LandingValue,
  ...LandingValue[],
];

export function landingPath(value: string | null | undefined): LandingPath | null {
  if (!value || value === "dashboard") return null;
  return LANDING_OPTIONS.find((o) => o.value === value)?.path ?? null;
}
