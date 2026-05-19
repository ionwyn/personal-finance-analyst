import { SyncSource } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getPlaidClient } from "@/lib/plaid/client";
import { refreshAccountsForItem, refreshBalancesForItem } from "@/lib/plaid/accounts";
import { syncPlaidItem } from "@/lib/plaid/sync";
import { encryptToken } from "@/lib/security/token-crypto";

export async function exchangeAndStorePlaidItem(input: {
  tenantId: string;
  userId?: string;
  publicToken: string;
  institutionId?: string | null;
  institutionName?: string | null;
  source?: SyncSource;
}) {
  const response = await getPlaidClient().itemPublicTokenExchange({
    public_token: input.publicToken,
  });

  const item = await prisma.plaidItem.upsert({
    where: {
      plaidItemId: response.data.item_id,
    },
    update: {
      tenantId: input.tenantId,
      createdById: input.userId,
      accessTokenEncrypted: encryptToken(response.data.access_token),
      institutionId: input.institutionId,
      institutionName: input.institutionName,
      errorCode: null,
      errorMessage: null,
    },
    create: {
      tenantId: input.tenantId,
      createdById: input.userId,
      plaidItemId: response.data.item_id,
      accessTokenEncrypted: encryptToken(response.data.access_token),
      institutionId: input.institutionId,
      institutionName: input.institutionName,
    },
  });

  await refreshAccountsForItem(item.id);
  await syncPlaidItem(item.id, input.source ?? SyncSource.MANUAL);
  await refreshBalancesForItem(item.id);

  return item;
}
