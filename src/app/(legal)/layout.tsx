import Link from "next/link";

import styles from "./legal.module.css";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.frame}>
      {/* ─── Top nav ─── */}
      <nav className={styles.topnav}>
        <Link href="/" className={styles.monoLockup}>
          <span className={styles.navGlyph} aria-hidden="true">
            <i /><i /><i />
          </span>
          <span>WYN FINANCIAL LTD.</span>
        </Link>
        <span className={styles.spacer} />
        <Link href="/" className={styles.navBack}>← Back to home</Link>
      </nav>

      {/* ─── Document ─── */}
      <main className={styles.main}>{children}</main>

      {/* ─── Footer ─── */}
      <footer className={styles.foot}>
        <span>© 2026 WYN Financial Ltd.</span>
        <span className={styles.footSpacer} />
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/security">Security</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/">Home</Link>
      </footer>
    </div>
  );
}
