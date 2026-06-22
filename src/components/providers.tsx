"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

import { PlaidLinkProvider } from "@/components/actions/plaid-link-button";
import { PwaRegistrar } from "@/components/pwa/pwa-registrar";

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
        <PlaidLinkProvider>
          <PwaRegistrar />
          {children}
        </PlaidLinkProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
