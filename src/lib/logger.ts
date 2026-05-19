import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import pino from "pino";

type LogContext = {
  requestId?: string;
  route?: string;
  tenantId?: string;
  provider?: "plaid" | "snaptrade" | "twelvedata";
  syncSource?: string;
};

const logContext = new AsyncLocalStorage<LogContext>();

const redactPaths = [
  "authorization",
  "cookie",
  "headers.authorization",
  "headers.cookie",
  "accessToken",
  "access_token",
  "linkToken",
  "link_token",
  "publicToken",
  "public_token",
  "secret",
  "userSecret",
  "clientSecret",
  "password",
  "*.authorization",
  "*.cookie",
  "*.accessToken",
  "*.access_token",
  "*.linkToken",
  "*.link_token",
  "*.publicToken",
  "*.public_token",
  "*.secret",
  "*.userSecret",
  "*.clientSecret",
  "*.password",
];

export const logger = pino({
  enabled: process.env.NODE_ENV !== "test" || Boolean(process.env.LOG_LEVEL),
  level: process.env.LOG_LEVEL ?? "info",
  base: {
    service: "td-personal-finance-analysis",
    environment: process.env.NODE_ENV ?? "development",
  },
  messageKey: "message",
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: redactPaths,
    censor: "[redacted]",
  },
  mixin() {
    return logContext.getStore() ?? {};
  },
});

export function getLogContext() {
  return logContext.getStore();
}

export function setLogContext(context: LogContext) {
  const current = logContext.getStore();
  if (current) Object.assign(current, context);
}

export async function withLogContext<T>(
  context: LogContext,
  callback: () => Promise<T>
): Promise<T> {
  const current = logContext.getStore() ?? {};
  return logContext.run({ ...current, ...context }, callback);
}

export function requestIdFromHeaders(headers?: Headers) {
  return headers?.get("x-request-id") ?? headers?.get("x-correlation-id") ?? randomUUID();
}

export function ensureRequestId() {
  return getLogContext()?.requestId ?? randomUUID();
}

export function normalizeSyncSource(source: string) {
  return source.toLowerCase();
}

export function safeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: sanitizeLogString(error.message),
    };
  }

  return {
    name: typeof error,
    message: sanitizeLogString(String(error)),
  };
}

export async function withRequestLogging<T>(
  request: Request | undefined,
  context: LogContext,
  callback: () => Promise<T>
): Promise<T> {
  const requestId = requestIdFromHeaders(request?.headers);
  const startedAt = performance.now();

  return withLogContext({ requestId, ...context }, async () => {
    logger.info("request started");

    try {
      const response = await callback();
      logger.info(
        {
          duration: elapsedMs(startedAt),
          status: response instanceof Response ? response.status : undefined,
        },
        "request completed"
      );
      return response;
    } catch (error) {
      logger.error(
        {
          duration: elapsedMs(startedAt),
          error: safeError(error),
        },
        "request failed"
      );
      throw error;
    }
  });
}

export function elapsedMs(startedAt: number) {
  return Math.round(performance.now() - startedAt);
}

function sanitizeLogString(value: string) {
  return value
    .replace(
      /\b(?:access|public|link)-(?:sandbox|development|production)-[A-Za-z0-9_-]+\b/g,
      "[redacted]"
    )
    .replace(
      /\b(access[_-]?token|public[_-]?token|link[_-]?token|secret|authorization|cookie|password)\b\s*[:=]\s*[^,\s)]+/gi,
      "$1=[redacted]"
    )
    .replace(/\b\d{8,}\b/g, "[redacted-number]");
}
