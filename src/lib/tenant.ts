import { Session } from "next-auth";
import { TenantKind } from "@prisma/client";

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
  if (session?.user?.id) {
    const tenant = await getUserTenant(session.user.id);
    return {
      tenantSlug: tenant?.slug ?? PERSONAL_TENANT_SLUG,
      tenantId: tenant?.id,
      isDemo: false,
    };
  }
  const demoTenant = await prisma.tenant.findUnique({ where: { slug: DEMO_TENANT_SLUG } });
  return {
    tenantSlug: DEMO_TENANT_SLUG,
    tenantId: demoTenant?.id,
    isDemo: true,
  };
}
