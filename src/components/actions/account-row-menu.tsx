"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeftRight, Eye, EyeOff, MoreHorizontal } from "lucide-react";

import { DropdownMenu, type MenuItemDef } from "@/components/ui";

export function AccountRowMenu({
  accountName,
  accountId,
  tracked,
  source = "plaid",
}: {
  accountName: string;
  accountId?: string;
  tracked?: boolean;
  source?: "plaid" | "snaptrade";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setTracked(next: boolean) {
    if (!accountId || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/${source}/accounts/${accountId}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracked: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const items: MenuItemDef[] = [
    {
      id: "view-transactions",
      label: "View transactions",
      icon: <ArrowLeftRight size={12} />,
      onAction: () =>
        router.push(`/app/transactions?account=${encodeURIComponent(accountName)}` as never),
    },
  ];

  if (accountId) {
    items.push({ id: "__sep__", label: "" });
    items.push(
      tracked
        ? {
            id: "untrack",
            label: "Untrack account",
            icon: <EyeOff size={12} />,
            disabled: busy,
            onAction: () => void setTracked(false),
          }
        : {
            id: "track",
            label: "Track account",
            icon: <Eye size={12} />,
            disabled: busy,
            onAction: () => void setTracked(true),
          }
    );
  }

  return (
    <DropdownMenu label="More actions" items={items}>
      <MoreHorizontal size={14} />
    </DropdownMenu>
  );
}
