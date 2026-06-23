"use client";

// Tiny event bus so any component that spends quota can push a fresh usage
// snapshot to the meter instantly, without prop-drilling or a context provider.

import type { ValafiUsageSnapshot } from "@/lib/valafi/types";

const EVENT = "valafi:usage";

export function publishUsage(usage: ValafiUsageSnapshot | undefined | null): void {
  if (usage && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: usage }));
  }
}

export function subscribeUsage(cb: (usage: ValafiUsageSnapshot) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<ValafiUsageSnapshot>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
