import type { Metadata } from "next";
import { Figtree, Manrope, IBM_Plex_Sans_Condensed } from "next/font/google";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fontCond.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
