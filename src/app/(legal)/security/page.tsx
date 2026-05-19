import type { Metadata } from "next";

import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Security — WYN Financial Ltd.",
  description:
    "How WYN Financial Ltd. protects your financial data: encryption, access control, and read-only design.",
};

export default function SecurityPage() {
  return (
    <article className={styles.doc}>
      <header className={styles.docHead}>
        <div className={styles.eyebrow}>Legal · Security</div>
        <h1>Security</h1>
        <div className={styles.meta}>
          <span>
            Last updated <strong>16 May 2026</strong>
          </span>
        </div>
      </header>

      <section className={styles.section}>
        <p className={styles.lead}>
          WYN Financial Ltd. handles sensitive financial data, and security is a core design
          constraint rather than an afterthought. This page describes the controls that protect your
          information and the boundaries the Service deliberately does not cross.
        </p>
        <div className={styles.callout}>
          <strong>Read-only by design.</strong> The Service can view your account data, but it
          cannot move money, place trades, or change your accounts. There is no code path that
          initiates a payment or a transaction — that capability simply does not exist.
        </div>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>01</span> Credential handling
        </h2>
        <p>
          We never ask for, see, or store your online banking or brokerage passwords. Authentication
          with your financial institutions is performed entirely within our regulated data providers
          — Plaid for personal banking and SnapTrade for brokerage accounts. They return a scoped,
          read-only access token; that token is all WYN Financial ever holds, and it cannot be used
          to authorise transfers or trades.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>02</span> Encryption
        </h2>
        <p>
          Provider access tokens are encrypted at rest using <strong>AES-256-GCM</strong>, an
          authenticated encryption algorithm, with a unique random initialisation vector generated
          for every record. Tokens are never written to logs or stored in plaintext. All data
          transmitted between your browser, the Service, and our providers is protected with
          industry-standard TLS encryption.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>03</span> Authentication and access control
        </h2>
        <p>
          Sign-in is handled through GitHub OAuth, so WYN Financial never manages or stores a
          password. Access to the private workspace is further limited to an explicit allowlist of
          approved email addresses — an account that is not on the allowlist cannot reach any
          financial data, even with valid GitHub credentials.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>04</span> Tenant isolation
        </h2>
        <p>
          Every record in the system is scoped to a single tenant. Queries are constrained to the
          signed-in user&rsquo;s tenant, so one workspace cannot read or modify the data of another.
          The public demo runs in its own isolated tenant populated only with sample data.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>05</span> Webhook verification
        </h2>
        <p>
          Inbound notifications from our data providers are cryptographically verified before they
          are processed. Plaid webhooks are validated by checking their{" "}
          <strong>ES256 JWT signature</strong> against Plaid&rsquo;s published public keys.
          Notifications that fail verification are rejected.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>06</span> Automated synchronisation
        </h2>
        <p>
          Scheduled data syncs run on a recurring job. The job endpoint is protected by a secret
          bearer token, so it cannot be triggered by an unauthenticated caller. Every sync — whether
          manual, scheduled, or webhook-driven — is recorded in an audit log capturing its source,
          status, record counts, and any error codes.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>07</span> Data storage
        </h2>
        <p>
          Financial data is stored in a PostgreSQL database under our control. Balance snapshots are
          immutable point-in-time records, and transactions are soft-deleted rather than destroyed,
          which preserves a verifiable history and supports recovery from provider data corrections.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>08</span> What we will never do
        </h2>
        <ul>
          <li>Move, transfer, or withdraw money from any account</li>
          <li>Place, modify, or cancel trades or orders</li>
          <li>Open, close, or change the settings of your accounts</li>
          <li>Store your banking or brokerage passwords</li>
          <li>Sell your data or share it for advertising</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>09</span> Your role in security
        </h2>
        <p>
          Because sign-in depends on GitHub, the security of your GitHub account directly protects
          your financial data. We strongly recommend enabling two-factor authentication on GitHub,
          using a strong and unique password, and reviewing your connected accounts periodically.
          Disconnect any institution you no longer wish to share.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>10</span> Responsible disclosure
        </h2>
        <p>
          We welcome reports from security researchers. If you believe you have found a
          vulnerability, please report it privately to{" "}
          <a href="mailto:sean.ionwyn@gmail.com">sean.ionwyn@gmail.com</a> with enough detail to
          reproduce the issue, and allow a reasonable period for it to be addressed before any
          public disclosure. Please do not access data that is not yours or degrade the Service
          while testing. We appreciate good-faith research and will acknowledge valid reports.
        </p>
      </section>
    </article>
  );
}
