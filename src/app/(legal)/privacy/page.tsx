import type { Metadata } from "next";

import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy — WYN Financial Ltd.",
  description:
    "How WYN Financial Ltd. collects, uses, stores, and protects your financial and account information."
};

export default function PrivacyPage() {
  return (
    <article className={styles.doc}>
      <header className={styles.docHead}>
        <div className={styles.eyebrow}>Legal · Privacy</div>
        <h1>Privacy Policy</h1>
        <div className={styles.meta}>
          <span>Effective <strong>16 May 2026</strong></span>
          <span>Last updated <strong>16 May 2026</strong></span>
        </div>
      </header>

      <section className={styles.section}>
        <p className={styles.lead}>
          WYN Financial Ltd. (&ldquo;WYN Financial&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
          operates a read-only personal finance dashboard that aggregates your bank, card, and
          brokerage accounts onto a single screen. This policy explains what information we
          process, why we process it, and the controls you have over it.
        </p>
        <div className={styles.callout}>
          <strong>The short version.</strong> We display your own financial data back to you.
          We never move money or place trades. We do not sell your data, and we do not use it
          for advertising. Account credentials are never seen or stored by us — they are handled
          by our regulated data providers.
        </div>
      </section>

      <section className={styles.section}>
        <h2><span className={styles.idx}>01</span> Scope</h2>
        <p>
          This policy applies to the WYN Financial dashboard and its supporting services. It
          does not cover the practices of third parties whose services you choose to connect,
          including your financial institutions and our data aggregation providers, each of
          which maintains its own privacy policy.
        </p>
      </section>

      <section className={styles.section}>
        <h2><span className={styles.idx}>02</span> Information we collect</h2>

        <h3>Identity and account data</h3>
        <p>
          When you sign in, we authenticate you through GitHub OAuth. We receive your name,
          email address, GitHub account identifier, and avatar URL. Access to the private
          workspace is further restricted to an explicit allowlist of approved email addresses.
        </p>

        <h3>Financial account data</h3>
        <p>
          When you link an institution, we retrieve and store the financial data needed to
          power your dashboard. Depending on the account type, this includes:
        </p>
        <ul>
          <li>Account names, types, masked numbers, and the connecting institution</li>
          <li>Current and available balances, captured as point-in-time snapshots</li>
          <li>Transaction history, including amount, date, description, merchant, and category</li>
          <li>Brokerage holdings, positions, and related portfolio details</li>
        </ul>

        <h3>Operational data</h3>
        <p>
          To keep your data fresh and to support troubleshooting, we retain technical records
          such as synchronisation timestamps, record counts, connection status, and error codes
          returned by our providers.
        </p>
      </section>

      <section className={styles.section}>
        <h2><span className={styles.idx}>03</span> How we collect financial data</h2>
        <p>
          We do not ask for, see, or store your online banking credentials. Account connections
          are established and maintained by regulated data aggregation providers:
        </p>
        <ul>
          <li>
            <strong>Personal banking</strong> connections are handled by{" "}
            <a href="https://plaid.com/legal/" target="_blank" rel="noopener noreferrer">
              Plaid
            </a>
            .
          </li>
          <li>
            <strong>Brokerage</strong> connections are handled by{" "}
            <a href="https://snaptrade.com/legal" target="_blank" rel="noopener noreferrer">
              SnapTrade
            </a>
            .
          </li>
        </ul>
        <p>
          You authenticate directly with these providers. They return a scoped, read-only access
          token that allows us to retrieve the data described above. Your use of these connections
          is also governed by each provider&rsquo;s own privacy policy.
        </p>
      </section>

      <section className={styles.section}>
        <h2><span className={styles.idx}>04</span> How we use your information</h2>
        <p>We process your information solely to provide the service. Specifically, to:</p>
        <ul>
          <li>Authenticate you and secure access to your workspace</li>
          <li>Display balances, cash flow, spending, and holdings on your dashboard</li>
          <li>Calculate analytics such as net worth trends and category breakdowns</li>
          <li>Keep connected accounts synchronised on a scheduled and on-demand basis</li>
          <li>Diagnose connection failures and maintain the reliability of the service</li>
        </ul>
        <p>
          We do not sell or rent your personal or financial data, and we do not use it for
          advertising, profiling for third parties, or any purpose unrelated to operating your
          dashboard.
        </p>
      </section>

      <section className={styles.section}>
        <h2><span className={styles.idx}>05</span> Storage and protection</h2>
        <p>
          Your financial data is stored in a PostgreSQL database under our control. Provider
          access tokens are encrypted at rest using AES-256-GCM with a unique initialisation
          vector per record. Data in transit is protected with industry-standard TLS encryption.
          Each tenant&rsquo;s data is logically isolated so that one workspace cannot access
          another. Additional detail is available on our{" "}
          <a href="/security">Security</a> page.
        </p>
      </section>

      <section className={styles.section}>
        <h2><span className={styles.idx}>06</span> Sharing and disclosure</h2>
        <p>We disclose information only in the limited circumstances below:</p>
        <ul>
          <li>
            <strong>Data providers</strong> — Plaid and SnapTrade, strictly to establish and
            maintain the account connections you authorise
          </li>
          <li>
            <strong>Infrastructure providers</strong> — hosting and database services that
            operate the application on our behalf under confidentiality obligations
          </li>
          <li>
            <strong>Legal compliance</strong> — where disclosure is required by applicable law,
            regulation, or valid legal process
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2><span className={styles.idx}>07</span> Data retention</h2>
        <p>
          We retain your financial data for as long as the corresponding account connection
          remains active, so that historical trends and balance snapshots stay available to you.
          When you disconnect an account or close your workspace, the associated data and
          encrypted tokens are deleted within a reasonable period, except where limited records
          must be retained to meet legal obligations.
        </p>
      </section>

      <section className={styles.section}>
        <h2><span className={styles.idx}>08</span> Your rights and choices</h2>
        <p>
          Subject to applicable law, you may request to access, export, correct, or delete your
          personal data, and you may disconnect any linked account at any time. To exercise any
          of these rights, contact us using the details below. We will respond within a
          reasonable timeframe.
        </p>
      </section>

      <section className={styles.section}>
        <h2><span className={styles.idx}>09</span> Sessions and cookies</h2>
        <p>
          We use a single essential session cookie to keep you signed in after authentication.
          We do not use advertising or third-party tracking cookies, and we do not run analytics
          that profile your activity across other sites.
        </p>
      </section>

      <section className={styles.section}>
        <h2><span className={styles.idx}>10</span> Public demo mode</h2>
        <p>
          The public demo is populated entirely with sample data and requires no account
          connection and no sign-in. No real financial information is collected, displayed, or
          stored when you use the demo.
        </p>
      </section>

      <section className={styles.section}>
        <h2><span className={styles.idx}>11</span> Children&rsquo;s privacy</h2>
        <p>
          The service is intended for adults and is not directed to anyone under the age of 18.
          We do not knowingly collect personal information from children.
        </p>
      </section>

      <section className={styles.section}>
        <h2><span className={styles.idx}>12</span> Changes to this policy</h2>
        <p>
          We may update this policy from time to time. When we do, we will revise the
          &ldquo;Last updated&rdquo; date above. Material changes will be communicated through
          the service. Continued use after an update constitutes acceptance of the revised policy.
        </p>
      </section>

      <section className={styles.section}>
        <h2><span className={styles.idx}>13</span> Contact us</h2>
        <p>
          Questions about this policy or requests regarding your data can be sent to{" "}
          <a href="mailto:sean.ionwyn@gmail.com">sean.ionwyn@gmail.com</a>. See our{" "}
          <a href="/contact">Contact</a> page for more ways to reach us.
        </p>
      </section>
    </article>
  );
}
