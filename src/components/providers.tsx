"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

import { PlaidLinkProvider } from "@/components/actions/plaid-link-button";

export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="data-theme"
        defaultTheme="dark"
        enableSystem
        storageKey="td-theme"
        nonce={nonce}
      >
        <PlaidLinkProvider>{children}</PlaidLinkProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
