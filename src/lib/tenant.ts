import { Session } from "next-auth";
import { TenantKind } from "@prisma/client";

import { getDeploymentMode } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const DEMO_TENANT_SLUG = "demo";
export const PERSONAL_TENANT_SLUG = "personal";

export async function getOrCreateDemoTenant() {
  return prisma.tenant.upsert({
    where: { slug: DEMO_TENANT_SLUG },
    update: {},
    create: {
      slug: DEMO_TENANT_SLUG,
      name: "Sandbox Demo",
      kind: TenantKind.DEMO,
    },
  });
}

export async function ensurePersonalTenantForUser(userId: string) {
  const tenant = await prisma.tenant.upsert({
    where: { slug: PERSONAL_TENANT_SLUG },
    update: {},
    create: {
      slug: PERSONAL_TENANT_SLUG,
      name: "Personal",
      kind: TenantKind.PERSONAL,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { tenantId: tenant.id },
  });

  return tenant;
}

export async function getUserTenant(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });

  if (!user) return null;
  if (user.tenant) return user.tenant;
  return ensurePersonalTenantForUser(user.id);
}

export async function resolveSessionTenant(session: Session | null): Promise<{
  tenantSlug: string;
  tenantId: string | undefined;
  isDemo: boolean;
}> {
  // Public demo deployment: everyone is served the demo tenant, regardless of
  // session. This DB holds only sandbox data, so there is nothing real to leak.
  if (getDeploymentMode() === "demo") {
    const demoTenant = await prisma.tenant.findUnique({ where: { slug: DEMO_TENANT_SLUG } });
    return {
      tenantSlug: DEMO_TENANT_SLUG,
      tenantId: demoTenant?.id,
      isDemo: true,
    };
  }

  // Private deployment: only an authenticated user resolves to a real tenant.
  if (session?.user?.id) {
    const tenant = await getUserTenant(session.user.id);
    return {
      tenantSlug: tenant?.slug ?? PERSONAL_TENANT_SLUG,
      tenantId: tenant?.id,
      isDemo: false,
    };
  }

  // Anonymous on the private deployment: fail closed. No demo fallback, no slug
  // that matches a tenant, so any query keyed on this resolves to zero rows.
  // Callers (the /app layout, the export route) must gate before reaching here.
  return {
    tenantSlug: "",
    tenantId: undefined,
    isDemo: false,
  };
}
