import { CountryCode } from "plaid";

import { prisma } from "@/lib/prisma";
import { getPlaidClient } from "@/lib/plaid/client";
import { logger, safeError } from "@/lib/logger";

/**
 * Fetches the institution logo from Plaid and caches it on the PlaidItem row.
 * Safe to call repeatedly — skips the API call if a logo is already stored.
 * Silently swallows errors so a logo failure never breaks the calling flow.
 */
export async function fetchAndCacheInstitutionLogo(
  itemId: string,
  institutionId: string | null | undefined
): Promise<void> {
  if (!institutionId) return;

  try {
    const existing = await prisma.plaidItem.findUnique({
      where: { id: itemId },
      select: { institutionLogo: true },
    });
    if (existing?.institutionLogo) return;

    const response = await getPlaidClient().institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Ca, CountryCode.Us],
      options: { include_optional_metadata: true },
    });

    const logo = response.data.institution.logo ?? null;
    if (!logo) return;

    await prisma.plaidItem.update({
      where: { id: itemId },
      data: { institutionLogo: logo },
    });

    logger.info({ itemId, institutionId }, "institution logo cached");
  } catch (err) {
    logger.warn({ itemId, institutionId, error: safeError(err) }, "institution logo fetch failed");
  }
}
