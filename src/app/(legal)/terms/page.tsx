import type { Metadata } from "next";

import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Terms of Service — WYN Financial Ltd.",
  description:
    "The terms governing your use of the WYN Financial Ltd. read-only finance dashboard.",
};

export default function TermsPage() {
  return (
    <article className={styles.doc}>
      <header className={styles.docHead}>
        <div className={styles.eyebrow}>Legal · Terms</div>
        <h1>Terms of Service</h1>
        <div className={styles.meta}>
          <span>
            Effective <strong>16 May 2026</strong>
          </span>
          <span>
            Last updated <strong>16 May 2026</strong>
          </span>
        </div>
      </header>

      <section className={styles.section}>
        <p className={styles.lead}>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the WYN
          Financial Ltd. dashboard and related services (the &ldquo;Service&rdquo;). By accessing or
          using the Service, you agree to be bound by these Terms. If you do not agree, do not use
          the Service.
        </p>
        <div className={styles.callout}>
          <strong>Important.</strong> The Service is an informational tool. It is read-only, it does
          not provide financial advice, and it cannot move money or place trades on your behalf.
          Please read sections 06 and 09 carefully.
        </div>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>01</span> The Service
        </h2>
        <p>
          WYN Financial provides a read-only dashboard that aggregates information from your linked
          bank, card, and brokerage accounts so that you can view balances, cash flow, spending, and
          holdings in one place. The Service displays and analyses your financial data; it does not
          hold funds, execute transactions, or act as a bank, broker, or financial institution.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>02</span> Eligibility and access
        </h2>
        <p>
          You must be at least 18 years old and able to form a binding contract to use the Service.
          Access to the private workspace is granted by invitation and restricted to an allowlist of
          approved accounts. You agree to provide accurate information and to use the Service only
          for your own personal, non-commercial purposes.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>03</span> Accounts and authentication
        </h2>
        <p>
          Authentication is performed through GitHub OAuth. You are responsible for maintaining the
          security of the GitHub account you use to sign in, and for all activity that occurs under
          your workspace. Notify us promptly if you believe your account has been accessed without
          authorisation.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>04</span> Connecting financial accounts
        </h2>
        <p>
          Account connections are established through our data aggregation providers — Plaid for
          personal banking and SnapTrade for brokerage accounts. By linking an account, you
          authorise these providers and WYN Financial to retrieve your account data on a read-only
          basis. Your use of those connections is also subject to the terms and privacy policies of
          the respective provider and of your financial institution.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>05</span> Acceptable use
        </h2>
        <p>You agree not to:</p>
        <ul>
          <li>
            Access data or accounts that do not belong to you, or that you are not authorised to
            view
          </li>
          <li>Attempt to circumvent authentication, access controls, or rate limits</li>
          <li>
            Probe, scan, or test the vulnerability of the Service except as permitted in our
            responsible disclosure process
          </li>
          <li>
            Interfere with, disrupt, or place an unreasonable load on the Service or its
            infrastructure
          </li>
          <li>Use the Service to violate any applicable law or the rights of any third party</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>06</span> Not financial advice
        </h2>
        <p>
          The Service is provided for informational and personal record-keeping purposes only.
          Nothing in the Service constitutes financial, investment, tax, accounting, or legal
          advice, and nothing should be relied upon as a recommendation to buy, sell, or hold any
          asset. You are solely responsible for your financial decisions and should consult a
          qualified professional where appropriate.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>07</span> Data accuracy and availability
        </h2>
        <p>
          The information shown in the Service originates from your financial institutions and is
          delivered through third-party providers. It may be delayed, incomplete, or inaccurate
          depending on institution and provider synchronisation schedules. The Service is the
          authoritative record of nothing — your financial institution&rsquo;s own statements remain
          the source of truth. We do not guarantee uninterrupted or error-free availability and may
          modify or suspend the Service at any time.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>08</span> Third-party services
        </h2>
        <p>
          The Service depends on third parties, including GitHub, Plaid, SnapTrade, and hosting
          providers. We are not responsible for the acts, omissions, availability, or content of
          third-party services, and your dealings with them are solely between you and that third
          party.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>09</span> Disclaimers and limitation of liability
        </h2>
        <p>
          The Service is provided <strong>&ldquo;as is&rdquo;</strong> and{" "}
          <strong>&ldquo;as available&rdquo;</strong>, without warranties of any kind, whether
          express or implied, including warranties of merchantability, fitness for a particular
          purpose, accuracy, and non-infringement, to the maximum extent permitted by law.
        </p>
        <p>
          To the maximum extent permitted by law, WYN Financial will not be liable for any indirect,
          incidental, special, consequential, or punitive damages, or for any loss of profits, data,
          or financial loss, arising out of or relating to your use of — or inability to use — the
          Service.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>10</span> Intellectual property
        </h2>
        <p>
          The Service, including its software, design, and branding, is owned by WYN Financial and
          its licensors. These Terms grant you a limited, non-exclusive, non-transferable right to
          use the Service. Your financial data remains yours; you grant us only the permissions
          necessary to operate the Service for you.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>11</span> Termination
        </h2>
        <p>
          You may stop using the Service and disconnect your accounts at any time. We may suspend or
          terminate access if you breach these Terms, if required for security or legal reasons, or
          if we discontinue the Service. On termination, the provisions that by their nature should
          survive — including disclaimers and limitations of liability — will continue to apply.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>12</span> Changes to these Terms
        </h2>
        <p>
          We may revise these Terms from time to time. When we do, we will update the &ldquo;Last
          updated&rdquo; date above and, for material changes, provide notice through the Service.
          Continued use after an update constitutes acceptance of the revised Terms.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>13</span> Governing law
        </h2>
        <p>
          These Terms are governed by the laws of the jurisdiction in which WYN Financial is
          established, without regard to its conflict-of-laws principles. Any dispute will be
          subject to the exclusive jurisdiction of the competent courts of that jurisdiction.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>14</span> Contact
        </h2>
        <p>
          Questions about these Terms can be sent to{" "}
          <a href="mailto:sean.ionwyn@gmail.com">sean.ionwyn@gmail.com</a>, or see the{" "}
          <a href="/contact">Contact</a> page.
        </p>
      </section>
    </article>
  );
}
