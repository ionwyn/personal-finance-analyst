import type { Prisma } from "@prisma/client";

import { isLiabilityType, numberValue } from "@/lib/analytics/dashboard-helpers";
import type { AccountSummary, InstitutionSummary, PlaidItemSummary } from "@/lib/analytics/types";

type PlaidAccount = Prisma.PlaidAccountGetPayload<object>;
type PlaidItemWithAccounts = Prisma.PlaidItemGetPayload<{ include: { accounts: true } }>;

export function mapAccountSummary(a: PlaidAccount): AccountSummary {
  return {
    id: a.id,
    itemId: a.itemId,
    name: a.name,
    officialName: a.officialName,
    type: a.type,
    subtype: a.subtype,
    mask: a.mask,
    availableBalance: numberValue(a.availableBalance),
    currentBalance: numberValue(a.currentBalance),
    isoCurrencyCode: a.isoCurrencyCode ?? "USD",
    lastBalanceAt: a.lastBalanceAt?.toISOString() ?? null,
  };
}

function basePlaidItemFields(item: PlaidItemWithAccounts): PlaidItemSummary {
  return {
    id: item.id,
    institutionName: item.institutionName ?? item.institutionId ?? "Linked institution",
    institutionId: item.institutionId,
    status: item.status,
    lastSyncAt: item.lastSyncAt?.toISOString() ?? null,
    lastBalanceRefreshAt: item.lastBalanceRefreshAt?.toISOString() ?? null,
    errorCode: item.errorCode,
    errorMessage: item.errorMessage,
  };
}

export function mapPlaidItemSummary(item: PlaidItemWithAccounts): PlaidItemSummary {
  return basePlaidItemFields(item);
}

export function mapInstitutionSummary(item: PlaidItemWithAccounts): InstitutionSummary {
  const accounts = item.accounts.map(mapAccountSummary);
  const total = accounts.reduce((s, a) => {
    const sign = isLiabilityType(a.type) ? -1 : 1;
    return s + sign * Math.abs(a.currentBalance);
  }, 0);
  return { ...basePlaidItemFields(item), total, accounts };
}
