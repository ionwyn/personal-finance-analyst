import "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      tenantId?: string;
      tenantSlug?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
