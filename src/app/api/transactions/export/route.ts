import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getDeploymentMode } from "@/lib/env";
import { getTransactionExportRows, transactionRowsToCsv } from "@/lib/transaction-export";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function defaultDateRange() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 29);

  return {
    from: from.toISOString().split("T")[0],
    to: today.toISOString().split("T")[0],
  };
}

function filterValue(params: URLSearchParams, key: string) {
  return params.get(key) ?? undefined;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  // Private deployment: an unauthenticated caller has no tenant — refuse rather
  // than letting resolveSessionTenant's fail-closed empty slug return an empty CSV.
  if (getDeploymentMode() === "private" && !session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { tenantSlug } = await resolveSessionTenant(session);
  const params = new URL(request.url).searchParams;
  const defaults = defaultDateRange();

  const rows = await getTransactionExportRows({
    tenantSlug,
    q: filterValue(params, "q"),
    from: filterValue(params, "from") ?? defaults.from,
    to: filterValue(params, "to") ?? defaults.to,
    category: filterValue(params, "category"),
    account: filterValue(params, "account"),
    bucket: filterValue(params, "bucket"),
    pending: filterValue(params, "pending"),
    amountMin: filterValue(params, "amountMin"),
    amountMax: filterValue(params, "amountMax"),
  });

  const today = new Date().toISOString().split("T")[0];

  return new Response(transactionRowsToCsv(rows), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="transactions-${today}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
