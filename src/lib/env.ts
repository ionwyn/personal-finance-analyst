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
