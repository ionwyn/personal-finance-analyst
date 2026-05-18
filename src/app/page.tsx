import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import styles from "./landing.module.css";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/app");

  return (
    <div className={styles.frame}>

      {/* ─── Top nav ─── */}
      <nav className={styles.topnav}>
        <div className={styles.monoLockup}>
          <span className={styles.navGlyph} aria-hidden="true">
            <i /><i /><i />
          </span>
          <span>WYN FINANCIAL LTD.</span>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className={styles.hero}>
        <div className={styles.watermark} aria-hidden="true">W</div>

        {/* Big mark + wordmark */}
        <div className={styles.bigMark}>
          <div className={styles.glyphXl} aria-hidden="true">
            <i className={styles.b1}><span className={styles.tip} /></i>
            <i className={styles.b2}><span className={styles.tip} /></i>
            <i className={styles.b3}><span className={styles.tip} /></i>
          </div>
          <div className={styles.word}>
            <div className={styles.wordName}>
              WYN Financial <span className={styles.ltd}>Ltd.</span>
            </div>
            <div className={styles.tagstrip}>
              <span>Personal</span><span>·</span>
              <span>Brokerage</span><span>·</span>
              <span className={styles.accentTag}>Read-only</span>
            </div>
          </div>
        </div>

        {/* Headline */}
        <div>
          <h1 className={styles.headline}>
            Banking and investing{" "}
            <em>in one place</em>
          </h1>
          <p className={styles.lede}>
            Connect once. Watch your net worth, spending, and holdings update
            on a single screen — without ever giving anyone the keys to move
            your money.
          </p>

          <div className={styles.actions}>
            <Link href="/signin" className={`${styles.landingBtn} ${styles.primary}`}>
              Login
              <span className={styles.kbd}>⏎</span>
            </Link>
            <Link href="/demo" className={styles.landingBtn}>
              View public demo
              <span className={styles.arrow}>→</span>
            </Link>
            <Link href="/privacy" className={`${styles.landingBtn} ${styles.ghost}`}>
              How we handle your data
              <span className={styles.arrow}>↗</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footnotes ─── */}
      <section className={styles.footnotes}>
        <div className={styles.fn}>
          <div className={`${styles.num} ${styles.green}`}>
            <span className={styles.dot} />01 · Read-only
          </div>
          <div className={styles.lbl}>Account access scope</div>
          <div className={styles.body}>
            We do not move money, place trades, or change your accounts.
          </div>
        </div>
        <div className={styles.fn}>
          <div className={`${styles.num} ${styles.info}`}>
            <span className={styles.dot} />02 · Providers
          </div>
          <div className={styles.lbl}>Connections handled by</div>
          <div className={styles.body}>
            <strong>Personal Banking via Plaid.</strong>{" "}
            <strong>Brokerage via SnapTrade.</strong>
          </div>
        </div>
        <div className={styles.fn}>
          <div className={`${styles.num} ${styles.teal}`}>
            <span className={styles.dot} />03 · Freshness
          </div>
          <div className={styles.lbl}>Data may be delayed</div>
          <div className={styles.body}>
            Data may be delayed depending on provider and institution sync
            schedules.
          </div>
        </div>
        <div className={styles.fn}>
          <div className={`${styles.num} ${styles.amber}`}>
            <span className={styles.dot} />04 · Public demo
          </div>
          <div className={styles.lbl}>No signup, no risk</div>
          <div className={styles.body}>
            Demo uses sample data.{" "}
            <strong>No account connection required.</strong>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className={styles.foot}>
        <span>© 2026 WYN Financial Ltd.</span>
        <Link href="/privacy" className={styles.dataBtn}>↗ How we handle your data</Link>
        <span className={styles.spacer} />
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/security">Security</Link>
        <Link href="/contact">Contact</Link>
      </footer>
    </div>
  );
}
