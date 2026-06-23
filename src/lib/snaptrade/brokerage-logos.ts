import { prisma } from "@/lib/prisma";
import { getSnapTradeClient } from "@/lib/snaptrade/client";
import { logger, safeError } from "@/lib/logger";

/**
 * Fetches all brokerages from SnapTrade's reference data API and caches
 * their square logo URLs on every SnapTradeConnection that has a matching
 * brokerageSlug and no logo yet. Safe to call repeatedly — skips connections
 * that already have a logo. Silently swallows errors.
 */
export async function fetchAndCacheBrokerageLogos(): Promise<void> {
  try {
    const missing = await prisma.snapTradeConnection.findMany({
      where: { brokerageSlug: { not: null }, brokerageLogo: null },
      select: { id: true, brokerageSlug: true },
    });
    if (missing.length === 0) return;

    const response = await getSnapTradeClient().referenceData.listAllBrokerages();
    const brokerages = response.data;

    const slugToLogo = new Map<string, string>();
    for (const brokerage of brokerages) {
      const slug = brokerage.slug;
      const logo = brokerage.aws_s3_square_logo_url ?? brokerage.aws_s3_logo_url;
      if (slug && logo) slugToLogo.set(slug, logo);
    }

    const updates = missing.flatMap((conn) => {
      const logo = conn.brokerageSlug ? slugToLogo.get(conn.brokerageSlug) : undefined;
      if (!logo) return [];
      return [
        prisma.snapTradeConnection.update({
          where: { id: conn.id },
          data: { brokerageLogo: logo },
        }),
      ];
    });

    if (updates.length === 0) return;
    await Promise.all(updates);
    logger.info({ count: updates.length }, "brokerage logos cached");
  } catch (err) {
    logger.warn({ error: safeError(err) }, "brokerage logo fetch failed");
  }
}
