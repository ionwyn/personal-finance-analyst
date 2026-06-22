import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WYN Financial Ltd.",
    short_name: "WYN",
    description: "Read-only finance terminal for accounts, cash flow, markets, and holdings.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    icons: [
      {
        src: "/icons/wyn-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/wyn-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/wyn-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/wyn-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Dashboard",
        url: "/app?home=1",
        icons: [{ src: "/icons/wyn-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Transactions",
        short_name: "Tx",
        url: "/app/transactions",
        icons: [{ src: "/icons/wyn-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Holdings",
        short_name: "Holdings",
        url: "/app/portfolio/holdings",
        icons: [{ src: "/icons/wyn-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Calendar",
        short_name: "Calendar",
        url: "/app/calendar",
        icons: [{ src: "/icons/wyn-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Settings",
        short_name: "Settings",
        url: "/app/settings?s=app-offline",
        icons: [{ src: "/icons/wyn-icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
