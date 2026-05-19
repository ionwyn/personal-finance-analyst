import type { Metadata } from "next";

import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Contact — WYN Financial Ltd.",
  description:
    "How to reach WYN Financial Ltd. for support, privacy, security, and legal inquiries.",
};

const EMAIL = "sean.ionwyn@gmail.com";

export default function ContactPage() {
  return (
    <article className={styles.doc}>
      <header className={styles.docHead}>
        <div className={styles.eyebrow}>Legal · Contact</div>
        <h1>Contact</h1>
        <div className={styles.meta}>
          <span>
            Last updated <strong>16 May 2026</strong>
          </span>
        </div>
      </header>

      <section className={styles.section}>
        <p className={styles.lead}>
          We are happy to help with any question about WYN Financial Ltd. — whether it concerns your
          account, your data, a security matter, or our legal terms. All inquiries are handled
          directly at the address below.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>01</span> How to reach us
        </h2>
        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.kicker}>General · Support</div>
            <h3>Help and account questions</h3>
            <p>
              Trouble linking an account, a question about your dashboard, or general feedback about
              the Service.
            </p>
            <a href={`mailto:${EMAIL}?subject=Support%20inquiry`}>{EMAIL}</a>
          </div>

          <div className={styles.card}>
            <div className={styles.kicker}>Privacy</div>
            <h3>Data requests</h3>
            <p>
              Requests to access, export, correct, or delete your personal data, or any question
              about our Privacy Policy.
            </p>
            <a href={`mailto:${EMAIL}?subject=Privacy%20request`}>{EMAIL}</a>
          </div>

          <div className={styles.card}>
            <div className={styles.kicker}>Security</div>
            <h3>Responsible disclosure</h3>
            <p>
              Report a suspected vulnerability or security concern. Please include enough detail for
              us to reproduce the issue.
            </p>
            <a href={`mailto:${EMAIL}?subject=Security%20report`}>{EMAIL}</a>
          </div>

          <div className={styles.card}>
            <div className={styles.kicker}>Legal</div>
            <h3>Terms and compliance</h3>
            <p>
              Questions about our Terms of Service, compliance matters, or other legal
              correspondence.
            </p>
            <a href={`mailto:${EMAIL}?subject=Legal%20inquiry`}>{EMAIL}</a>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>02</span> Response times
        </h2>
        <p>
          We aim to acknowledge messages within a few business days. Security reports are
          prioritised — please use the subject line <strong>&ldquo;Security report&rdquo;</strong>{" "}
          so they can be triaged quickly.
        </p>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>03</span> Helpful details to include
        </h2>
        <p>To help us respond accurately, please include where relevant:</p>
        <ul>
          <li>The email address associated with your workspace</li>
          <li>A clear description of the issue or request, and the time it occurred</li>
          <li>
            The institution or account type involved, without sharing full account numbers or
            credentials
          </li>
          <li>For security reports, steps to reproduce the issue</li>
        </ul>
        <div className={styles.callout}>
          <strong>Never send credentials.</strong> WYN Financial will never ask for your banking or
          brokerage passwords, one-time codes, or full account numbers. Do not include them in any
          message to us.
        </div>
      </section>

      <section className={styles.section}>
        <h2>
          <span className={styles.idx}>04</span> Related pages
        </h2>
        <p>
          See our <a href="/privacy">Privacy Policy</a>, <a href="/terms">Terms of Service</a>, and{" "}
          <a href="/security">Security</a> page for more detail on how the Service operates and how
          your data is protected.
        </p>
      </section>
    </article>
  );
}
