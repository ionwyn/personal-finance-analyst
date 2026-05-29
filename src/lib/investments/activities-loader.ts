import { prisma } from "@/lib/prisma";
import { groupOf, type ActivityGroupKey } from "./activity-types";

const ACTIVITY_CAP = 1000;

const LOGO_PALETTE = [
  "#a6192e",
  "#0072c6",
  "#1d1d1f",
  "#0d8b3e",
  "#00a4ef",
  "#ed1a3b",
  "#7ab55c",
  "#4285f4",
  "#ff6a00",
  "#76b900",
  "#1f3a93",
  "#003168",
  "#ff9900",
  "#0668e1",
  "#cc0000",
  "#e21c2c",
  "#000000",
];

function hashColor(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return LOGO_PALETTE[h % LOGO_PALETTE.length] ?? "#1f3a93";
}

function logoText(name: string | null | undefined) {
  return (
    (name ?? "ST")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "ST"
  );
}

function nullableNumber(value: { toNumber(): number } | number | null | undefined) {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber();
}

export type ActivityRow = {
  id: string;
  accountId: string;
  accountLabel: string;
  institution: string;
  institutionLogoBg: string;
  institutionLogoText: string;
  type: string;
  group: ActivityGroupKey;
  symbol: string | null;
  symbolLogoBg: string | null;
  description: string | null;
  units: number | null;
  price: number | null;
  amount: number | null;
  fee: number;
  currency: string;
  fxRate: number | null;
  tradeDate: string | null;
  settlementDate: string | null;
  externalReferenceId: string | null;
};

export type ActivityAccountOption = {
  id: string;
  label: string;
  institution: string;
};

export type LoadedActivities = {
  rows: ActivityRow[];
  totalRowCount: number;
  cappedAt: number | null;
  accountOptions: ActivityAccountOption[];
};

export async function loadActivities(tenantId?: string | null): Promise<LoadedActivities> {
  if (!tenantId) {
    return { rows: [], totalRowCount: 0, cappedAt: null, accountOptions: [] };
  }

  const [totalRowCount, raw] = await Promise.all([
    prisma.snapTradeActivity.count({ where: { tenantId } }),
    prisma.snapTradeActivity.findMany({
      where: { tenantId },
      orderBy: [{ tradeDate: "desc" }, { createdAt: "desc" }],
      take: ACTIVITY_CAP,
      include: {
        account: {
          include: { connection: true },
        },
      },
    }),
  ]);

  const rows: ActivityRow[] = raw.map((activity) => {
    const account = activity.account;
    const institution = account.institutionName ?? account.connection.brokerageName ?? "Brokerage";
    const accountLabel = (
      account.accountCategory ??
      account.rawType ??
      account.name ??
      "Account"
    ).toUpperCase();
    const type = activity.type;

    return {
      id: activity.id,
      accountId: account.id,
      accountLabel,
      institution,
      institutionLogoBg: hashColor(institution),
      institutionLogoText: logoText(institution),
      type,
      group: groupOf(type),
      symbol: activity.symbol,
      symbolLogoBg: activity.symbol ? hashColor(activity.symbol) : null,
      description: activity.description,
      units: nullableNumber(activity.units),
      price: nullableNumber(activity.price),
      amount: nullableNumber(activity.amount),
      fee: nullableNumber(activity.fee) ?? 0,
      currency: activity.currency,
      fxRate: nullableNumber(activity.fxRate),
      tradeDate: activity.tradeDate?.toISOString() ?? null,
      settlementDate: activity.settlementDate?.toISOString() ?? null,
      externalReferenceId: activity.externalReferenceId,
    };
  });

  const accountOptionsMap = new Map<string, ActivityAccountOption>();
  for (const row of rows) {
    if (!accountOptionsMap.has(row.accountId)) {
      accountOptionsMap.set(row.accountId, {
        id: row.accountId,
        label: row.accountLabel,
        institution: row.institution,
      });
    }
  }

  return {
    rows,
    totalRowCount,
    cappedAt: totalRowCount > ACTIVITY_CAP ? ACTIVITY_CAP : null,
    accountOptions: [...accountOptionsMap.values()].sort((a, b) => a.label.localeCompare(b.label)),
  };
}
