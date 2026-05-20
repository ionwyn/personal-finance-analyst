"use client";

import type { CSSProperties } from "react";

export const INPUT_STYLE: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  padding: "6px 8px",
  fontSize: 12,
  borderRadius: 4,
  fontFamily: "var(--font-sans)",
  width: "100%",
};

export const NUMBER_INPUT_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  fontFamily: "var(--font-mono)",
  textAlign: "right",
};

export const LABEL_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 11,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-3)",
};

export const HINT_STYLE: CSSProperties = {
  fontSize: 10,
  letterSpacing: 0,
  textTransform: "none",
  color: "var(--text-4)",
  lineHeight: 1.4,
  fontWeight: 400,
};

type ApiResponse = { error?: string } & Record<string, unknown>;

export async function postJSON(url: string, method: string, body: unknown): Promise<ApiResponse> {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body),
  });
  let data: ApiResponse = {};
  try {
    data = (await response.json()) as ApiResponse;
  } catch {
    // ignore JSON parse failures on empty bodies
  }
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed with ${response.status}`);
  }
  return data;
}

export function toDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return <span className="inline-error">{error}</span>;
}
