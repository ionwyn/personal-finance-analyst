import { prisma } from "@/lib/prisma";
import { groupOf, type ActivityGroupKey } from "./activity-types";
import { toNullableNumber } from "./shared/decimal";
import { hashColor, logoText } from "./shared/logo";

const ACTIVITY_CAP = 1000;

export type ActivityRow = {
  id: string;
  accountId: string;
  accountLabel: string;
  institution: string;
  institutionLogo: string | null;
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
  sourceProviders: string[];
  sourceReferences: string[];
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

function displayType(entry: {
  activityType: string;
  activitySubType: string | null;
  units: { isNegative(): boolean };
  cashAmount: { isPositive(): boolean } | null;
}) {
  if (entry.activityType === "Trade") return entry.activitySubType ?? "TRADE";
  if (entry.activityType === "Dividend") return "DIVIDEND";
  if (entry.activityType === "StockDividend") return "STOCK_DIVIDEND";
  if (entry.activityType === "Interest") return "INTEREST";
  if (entry.activityType === "Fee") return entry.activitySubType === "TAX" ? "TAX" : "FEE";
  if (entry.activityType === "AdministrativePayment") return "REIMBURSEMENT";
  if (entry.activityType === "InternalSecurityTransfer") {
    return entry.units.isNegative() ? "EXTERNAL_ASSET_TRANSFER_OUT" : "EXTERNAL_ASSET_TRANSFER_IN";
  }
  if (entry.activityType === "MoneyMovement") {
    if (entry.activitySubType === "TRANSFER_TF") return "TRANSFER";
    return entry.cashAmount?.isPositive() ? "WITHDRAWAL" : "CONTRIBUTION";
  }
  return entry.activitySubType ?? entry.activityType.toUpperCase();
}

export async function loadActivities(tenantId?: string | null): Promise<LoadedActivities> {
  if (!tenantId) {
    return { rows: [], totalRowCount: 0, cappedAt: null, accountOptions: [] };
  }

  const [totalRowCount, raw] = await Promise.all([
    prisma.brokerLedgerEntry.count({
      where: { tenantId, account: { is: { tracked: true } } },
    }),
    prisma.brokerLedgerEntry.findMany({
      where: { tenantId, account: { is: { tracked: true } } },
      orderBy: [{ tradeDate: "desc" }, { createdAt: "desc" }],
      take: ACTIVITY_CAP,
      include: {
        account: {
          include: { connection: true },
        },
        sourceRecords: {
          orderBy: [{ provider: "asc" }, { sourceKey: "asc" }],
          select: { provider: true, providerRecordId: true, sourceKey: true },
        },
      },
    }),
  ]);

  const rows: ActivityRow[] = raw.flatMap((activity) => {
    const account = activity.account;
    if (!account) return [];
    const institution = account.institutionName ?? account.connection.brokerageName ?? "Brokerage";
    const accountLabel = (
      account.accountCategory ??
      account.rawType ??
      account.name ??
      "Account"
    ).toUpperCase();
    const type = displayType(activity);
    const sourceReferences = activity.sourceRecords.map(
      (source) => source.providerRecordId ?? source.sourceKey
    );
    const amount = activity.cashAmount == null ? null : activity.cashAmount.negated().toNumber();
    const fee =
      activity.activityType === "Fee" && activity.cashAmount?.isPositive()
        ? activity.cashAmount.toNumber()
        : 0;

    return [
      {
        id: activity.id,
        accountId: account.id,
        accountLabel,
        institution,
        institutionLogo: account.connection.brokerageLogo ?? null,
        institutionLogoBg: hashColor(institution),
        institutionLogoText: logoText(institution),
        type,
        group: groupOf(type),
        symbol: activity.symbolNorm ?? null,
        symbolLogoBg: activity.symbolNorm ? hashColor(activity.symbolNorm) : null,
        description: activity.name,
        units: activity.units.isZero() ? null : activity.units.toNumber(),
        price: toNullableNumber(activity.unitPrice),
        amount,
        fee,
        currency: "CAD",
        fxRate: toNullableNumber(activity.fxRate),
        tradeDate: activity.tradeDate.toISOString(),
        settlementDate: activity.settlementDate?.toISOString() ?? null,
        externalReferenceId: sourceReferences[0] ?? null,
        sourceProviders: [...new Set(activity.sourceRecords.map((source) => source.provider))],
        sourceReferences,
      },
    ];
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
