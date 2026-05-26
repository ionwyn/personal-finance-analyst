"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Tiny copy-to-clipboard button used in the Connections webhook pill. */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (e.g. insecure context) — no-op
    }
  }

  return (
    <button type="button" className="btn btn-sm btn-ghost" onClick={copy} aria-label={label}>
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied" : label}
    </button>
  );
}
