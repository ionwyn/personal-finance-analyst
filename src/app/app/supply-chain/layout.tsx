import type { ReactNode } from "react";

import { QuotaMeter } from "@/components/features/supply-chain/quota-meter";
import { SubNav } from "@/components/features/supply-chain/sc-subnav";
import styles from "@/components/features/supply-chain/splc.module.scss";
import { getUsage } from "@/lib/valafi/governor";

export const dynamic = "force-dynamic";

export default async function SupplyChainLayout({ children }: { children: ReactNode }) {
  const usage = await getUsage();

  return (
    <div className={styles.shell}>
      <header className={styles.shellHead}>
        <div>
          <h1 className={styles.h1}>Supply Chain</h1>
          <p className={styles.sub}>
            SEC-filing supply graph · suppliers, customers, competitors &amp; concentration risk
          </p>
        </div>
        <QuotaMeter initial={usage} />
      </header>
      <SubNav />
      <div className={styles.body}>{children}</div>
    </div>
  );
}
