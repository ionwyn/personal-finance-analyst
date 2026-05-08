import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

import { optionalCsv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { ensurePersonalTenantForUser, getUserTenant } from "@/lib/tenant";

const githubClientId = process.env.GITHUB_ID;
const githubClientSecret = process.env.GITHUB_SECRET;

async function getAllowedGithubEmail(input: {
  profileEmail?: string | null;
  accessToken?: string;
  allowedEmails: string[];
}) {
  if (input.profileEmail && input.allowedEmails.includes(input.profileEmail.toLowerCase())) {
    return input.profileEmail;
  }

  if (!input.accessToken) return null;

  const response = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      Accept: "application/vnd.github+json"
    }
  });

  if (!response.ok) return null;

  const emails = (await response.json()) as Array<{
    email?: string;
    primary?: boolean;
    verified?: boolean;
  }>;

  return (
    emails.find(
      (entry) =>
        entry.email &&
        entry.verified &&
        input.allowedEmails.includes(entry.email.toLowerCase())
    )?.email ?? null
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database"
  },
  providers:
    githubClientId && githubClientSecret
      ? [
          GitHubProvider({
            clientId: githubClientId,
            clientSecret: githubClientSecret,
            authorization: {
              params: {
                scope: "read:user user:email"
              }
            }
          })
        ]
      : [],
  callbacks: {
    async signIn({ user, account }) {
      const allowedEmails = optionalCsv("ADMIN_EMAILS");
      if (allowedEmails.length === 0) return true;

      const allowedEmail = await getAllowedGithubEmail({
        profileEmail: user.email,
        accessToken: account?.access_token,
        allowedEmails
      });

      if (allowedEmail) {
        user.email = allowedEmail;
        return true;
      }

      return false;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const tenant = await getUserTenant(user.id);
        session.user.tenantId = tenant?.id;
        session.user.tenantSlug = tenant?.slug;
      }

      return session;
    }
  },
  events: {
    async createUser({ user }) {
      await ensurePersonalTenantForUser(user.id);
    }
  },
  pages: {
    signIn: "/signin"
  }
};
