import type { Metadata } from "next";
import { Figtree, Manrope, IBM_Plex_Sans_Condensed } from "next/font/google";
import { headers } from "next/headers";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { Providers } from "@/components/providers";
import "@/app/globals.scss";

const geistSans = Figtree({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Manrope({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const fontCond = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cond-family",
});

export const metadata: Metadata = {
  title: "WYN Financial Ltd. — Read-only finance terminal",
  description: "See every bank, card, and brokerage account in one read-only dashboard.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read the per-request nonce set by proxy. This also opts every route
  // into dynamic rendering, so the strict nonce-based CSP applies everywhere
  // (static prerenders can't carry a per-request nonce).
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fontCond.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers nonce={nonce}>{children}</Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
