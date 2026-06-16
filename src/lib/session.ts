import { cache } from "react";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { resolveSessionTenant } from "@/lib/tenant";

/**
 * Per-request cached session + tenant resolution.
 *
 * The `/app` segment layout renders the shell from the session, and each page
 * still resolves its own tenant for data fetching. Wrapping these in React
 * `cache()` dedupes them so the layout + page share a single resolution per
 * request instead of hitting NextAuth / the DB twice.
 */
export const getSession = cache(() => getServerSession(authOptions));

export const getSessionTenant = cache(async () => {
  const session = await getSession();
  const tenant = await resolveSessionTenant(session);
  return { session, ...tenant };
});
