import { z } from "zod";

const plaidEnvSchema = z.enum(["sandbox", "development", "production"]);

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalCsv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function getPlaidEnv() {
  return plaidEnvSchema.parse(process.env.PLAID_ENV ?? "sandbox");
}

export type DeploymentMode = "private" | "demo";

/**
 * Which kind of deployment this instance is. `private` (default) is the owner's
 * real workspace behind GitHub OAuth; `demo` is the public, sandbox-only build
 * that must never hold or reach real financial data. Set via `DEPLOYMENT_MODE`.
 */
export function getDeploymentMode(): DeploymentMode {
  return process.env.DEPLOYMENT_MODE === "demo" ? "demo" : "private";
}

/** Twelve Data API key (used for FX rates). Throws when missing at call time. */
export function getTwelveDataApiKey(): string {
  return requireEnv("TWELVEDATA_API_KEY");
}

/** FRED API key (macro series: yields, CPI, policy rate). Throws when missing. */
export function getFredApiKey(): string {
  return requireEnv("FRED_API_KEY");
}

/** Financial Modeling Prep key (optional fallback provider). Null when unset. */
export function getFmpApiKey(): string | null {
  return process.env.FMP_API_KEY || null;
}

/** Alpha Vantage key (optional fallback provider). Null when unset. */
export function getAlphaVantageApiKey(): string | null {
  return process.env.ALPHA_VANTAGE_API_KEY || null;
}

/** Finnhub key (earnings surprises, rec trends, insider activity, peers). */
export function getFinnhubApiKey(): string | null {
  return process.env.FINNHUB_API_KEY || null;
}

/** Contact string for SEC EDGAR's required User-Agent header. */
export function getEdgarUserAgent(): string {
  const contact = optionalCsv("ADMIN_EMAILS")[0] ?? "unspecified-contact";
  return `personal-finance-dashboard/1.0 (${contact})`;
}

export function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export function getPlaidWebhookUrl(): string {
  return process.env.PLAID_WEBHOOK_URL || `${getBaseUrl()}/api/webhooks/plaid`;
}

export function assertWebhookConfig() {
  if (process.env.NODE_ENV === "production" && process.env.PLAID_VERIFY_WEBHOOKS === "false") {
    throw new Error("PLAID_VERIFY_WEBHOOKS=false is not allowed in production.");
  }
}
