import { getServerSession } from "next-auth";

import { CurrencyProvider } from "@/components/providers/currency-provider";
import { authOptions } from "@/lib/auth";
import { resolveDisplayCurrency } from "@/lib/fx/displayRate";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * Wraps every protected /app page in the CurrencyProvider so the chosen display
 * currency (and the base→display FX rate) is available to all client views.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const { tenantId } = await resolveSessionTenant(session);
  const { currency, rate } = await resolveDisplayCurrency(tenantId);

  return (
    <CurrencyProvider currency={currency} rate={rate}>
      {children}
    </CurrencyProvider>
  );
}
