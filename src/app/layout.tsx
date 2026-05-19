import type { Metadata } from "next";
import { Figtree, Manrope } from "next/font/google";

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

export const metadata: Metadata = {
  title: "WYN Financial Ltd. — Read-only finance terminal",
  description: "See every bank, card, and brokerage account in one read-only dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
