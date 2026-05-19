import { format, startOfMonth } from "date-fns";
import { Prisma } from "@prisma/client";

export const CATEGORY_COLORS = [
  "var(--cat-1)",
  "var(--cat-2)",
  "var(--cat-3)",
  "var(--cat-4)",
  "var(--cat-5)",
  "var(--cat-6)",
  "var(--cat-7)",
  "var(--cat-8)",
];

export function numberValue(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

export function monthKey(date: Date) {
  return format(startOfMonth(date), "yyyy-MM");
}

export function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return format(new Date(year, month - 1, 1), "MMM");
}

export function delta(curr: number, prev: number) {
  if (!prev) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function colorForCategory(category: string, index: number) {
  if (category === "Income" || /income/i.test(category)) return "var(--pos)";
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

export function isLiabilityType(type: string) {
  const lower = type.toLowerCase();
  return lower.includes("credit") || lower.includes("loan");
}

export function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
