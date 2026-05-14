"use client";

import { SessionProvider } from "next-auth/react";

import { PlaidLinkProvider } from "@/components/plaid-link-button";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PlaidLinkProvider>{children}</PlaidLinkProvider>
    </SessionProvider>
  );
}
