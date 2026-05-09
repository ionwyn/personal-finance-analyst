import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";

const ALLOWED_LOGO_HOSTS = new Set(["api.twelvedata.com", "logo.twelvedata.com"]);
const MAX_LOGO_BYTES = 256 * 1024;

export function normalizeSnapTradeLogoUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (!ALLOWED_LOGO_HOSTS.has(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function logoIdForUrl(url: string) {
  return createHash("sha256").update(url).digest("hex");
}

export async function ensureLogoRecord(sourceUrl: string | null) {
  if (!sourceUrl) return null;
  const url = normalizeSnapTradeLogoUrl(sourceUrl);
  if (!url) return null;
  const id = logoIdForUrl(url);

  await prisma.snapTradeSecurityLogo.upsert({
    where: { id },
    update: { sourceUrl: url },
    create: {
      id,
      sourceUrl: url
    }
  });

  return id;
}

export async function fetchAndCacheLogo(id: string) {
  const logo = await prisma.snapTradeSecurityLogo.findUnique({ where: { id } });
  if (!logo) return null;
  if (logo.status === "READY" && logo.data && logo.contentType) return logo;
  if (logo.status === "ERROR") return logo;

  const sourceUrl = normalizeSnapTradeLogoUrl(logo.sourceUrl);
  if (!sourceUrl) {
    return prisma.snapTradeSecurityLogo.update({
      where: { id },
      data: {
        status: "ERROR",
        errorMessage: "Logo URL is not allowed.",
        fetchedAt: new Date()
      }
    });
  }

  try {
    const response = await fetch(sourceUrl, {
      headers: { accept: "image/*" }
    });
    if (!response.ok) {
      throw new Error(`Logo fetch failed with HTTP ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      throw new Error("Logo response was not an image.");
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_LOGO_BYTES) {
      throw new Error("Logo response was too large.");
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_LOGO_BYTES) {
      throw new Error("Logo response was too large.");
    }

    return prisma.snapTradeSecurityLogo.update({
      where: { id },
      data: {
        status: "READY",
        contentType,
        data: bytes,
        errorMessage: null,
        fetchedAt: new Date()
      }
    });
  } catch (error) {
    return prisma.snapTradeSecurityLogo.update({
      where: { id },
      data: {
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Logo fetch failed.",
        fetchedAt: new Date()
      }
    });
  }
}
