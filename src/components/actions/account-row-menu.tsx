"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftRight, MoreHorizontal } from "lucide-react";

import { DropdownMenu } from "@/components/ui";

export function AccountRowMenu({ accountName }: { accountName: string }) {
  const router = useRouter();

  return (
    <DropdownMenu
      label="More actions"
      items={[
        {
          id: "view-transactions",
          label: "View transactions",
          icon: <ArrowLeftRight size={12} />,
          onAction: () =>
            router.push(`/app/transactions?account=${encodeURIComponent(accountName)}` as never),
        },
      ]}
    >
      <MoreHorizontal size={14} />
    </DropdownMenu>
  );
}
