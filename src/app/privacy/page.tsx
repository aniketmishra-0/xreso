import type { Metadata } from "next";
import Link from "next/link";
import styles from "../info-page.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How xreso collects, uses, and protects user and contributor data.",
};

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.kicker}>Privacy</span>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.description}>
            This policy explains what data xreso processes, why it is processed,
            and which controls are available to users. xreso is an open-source,
            community-driven platform for sharing programming notes.
          </p>
          <p className={styles.meta}>Effective date: April 15, 2026</p>
        </header>

        <div className={styles.sectionList}>
          {/* ── 1. Data Controller ──────────────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>1. Data controller</h2>
            <p>
              xreso is an open-source project maintained by Aniket Mishra. For all
              data-related inquiries, contact us at{" "}
              <a href="mailto:xresoinc@gmail.com" className={styles.link}>
                xresoinc@gmail.com
              </a>
              .
            </p>
          </section>

          {/* ── 2. Data We Collect ──────────────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Data we collect</h2>
            <ul>
              <li>
                <strong>Account information:</strong> Name, email address, profile
                photo, and role metadata when you create an account.
              </li>
              <li>
                <strong>Authentication data:</strong> OAuth provider identifiers
                (Google, GitHub, LinkedIn) or hashed password for credential-based
                accounts. We never store plaintext passwords.
              </li>
              <li>
                <strong>Contributed content:</strong> Notes, resources, and
                associated metadata (title, description, tags, license) you upload.
              </li>
              <li>
                <strong>Usage data:</strong> Page views, bookmark counts, search
                queries, and moderation actions for platform analytics.
              </li>
              <li>
                <strong>Security logs:</strong> IP addresses, user agents, and
                timestamps for authentication events, rate limiting, and abuse
                prevention. These are retained for fraud detection.
              </li>
              <li>
                <strong>Cookies:</strong> Essential session cookies for
                authentication (httpOnly, secure). Optional analytics cookies are
                only set with your consent via the cookie banner.
              </li>
            </ul>
          </section>

          {/* ── 3. Lawful Basis ────────────────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              3. Lawful basis for processing (GDPR Article 6)
            </h2>
            <ul>
              <li>
                <strong>Contract performance:</strong> Processing your account data
                to provide the xreso platform services you signed up for.
              </li>
              <li>
                <strong>Legitimate interest:</strong> Security logging, abuse
                prevention, content moderation, and service improvement.
              </li>
              <li>
                <strong>Consent:</strong> Analytics and advertising cookies are only
                activated after you explicitly accept via the cookie consent banner.
              </li>
              <li>
                <strong>Legal obligation:</strong> Responding to valid legal
                requests such as DMCA takedown notices and court orders.
              </li>
            </ul>
          </section>

          {/* ── 4. How Data Is Used ────────────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>4. How data is used</h2>
            <ul>
              <li>Operate authentication, contributions, search, and recommendations.</li>
              <li>Moderate content quality and enforce community guidelines.</li>
              <li>Maintain audit trails for admin actions and account security.</li>
              <li>Send transactional emails (welcome, note approval, password reset).</li>
              <li>Improve reliability, performance, and product decisions.</li>
              <li>Serve contextual advertisements (Google AdSense) — only with cookie consent.</li>
            </ul>
          </section>

          {/* ── 5. Third-Party Processors ─────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>5. Third-party processors</h2>
            <p>
              We use the following services to operate xreso. Each processes data
              under their own privacy policies and data processing agreements:
            </p>
            <ul>
              <li>
                <strong>Vercel</strong> (USA) — Hosting, serverless functions, edge
                network
              </li>
              <li>
                <strong>Turso / LibSQL</strong> (USA) — Primary database
              </li>
              <li>
                <strong>Cloudflare R2</strong> (Global) — File and media storage
              </li>
              <li>
                <strong>Resend</strong> (USA) — Transactional email delivery
              </li>
              <li>
                <strong>Upstash</strong> (Global) — Rate limiting via Redis
              </li>
              <li>
                <strong>Google AdSense</strong> (USA) — Contextual advertising
                (consent-gated)
              </li>
              <li>
                <strong>Google / GitHub / LinkedIn</strong> — OAuth authentication
                providers
              </li>
            </ul>
          </section>

          {/* ── 6. International Transfers ────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>6. International data transfers</h2>
            <p>
              Your data may be processed in the United States and other countries
              where our processors operate. These transfers are protected by:
            </p>
            <ul>
              <li>Standard Contractual Clauses (SCCs) with our processors</li>
              <li>
                EU-US Data Privacy Framework certifications where applicable
              </li>
              <li>Encryption in transit (TLS 1.2+) and at rest</li>
            </ul>
          </section>

          {/* ── 7. Retention Periods ─────────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>7. Data retention periods</h2>
            <ul>
              <li>
                <strong>Account data:</strong> Retained until you request account
                deletion.
              </li>
              <li>
                <strong>Contributed content:</strong> Retained as long as the
                resource remains published. Removed upon takedown or account
                deletion.
              </li>
              <li>
                <strong>Security and auth logs:</strong> 90 days from creation.
              </li>
              <li>
                <strong>Rate limiting data:</strong> Automatically expires within
                minutes to hours depending on the limit window.
              </li>
              <li>
                <strong>Password reset tokens:</strong> Expire and are invalidated
                after 1 hour.
              </li>
              <li>
                <strong>Cookie consent preference:</strong> Stored locally in your
                browser (localStorage) — never sent to our servers.
              </li>
            </ul>
          </section>

          {/* ── 8. Your Rights (GDPR) ────────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              8. Your rights under GDPR
            </h2>
            <p>
              If you are located in the European Economic Area (EEA), United
              Kingdom, or a jurisdiction with similar data protection laws, you
              have the following rights:
            </p>
            <ul>
              <li>
                <strong>Right of access:</strong> Request a copy of the personal
                data we hold about you.
              </li>
              <li>
                <strong>Right to rectification:</strong> Correct inaccurate data
                via your profile settings or by contacting us.
              </li>
              <li>
                <strong>Right to erasure:</strong> Request deletion of your account
                and associated data.
              </li>
              <li>
                <strong>Right to restrict processing:</strong> Request that we
                limit how we use your data.
              </li>
              <li>
                <strong>Right to data portability:</strong> Receive your data in a
                structured, machine-readable format.
              </li>
              <li>
                <strong>Right to object:</strong> Object to processing based on
                legitimate interest, including profiling.
              </li>
              <li>
                <strong>Right to withdraw consent:</strong> Withdraw cookie or
                marketing consent at any time via the cookie settings or by
                contacting us.
              </li>
            </ul>
            <p>
              To exercise any of these rights, email us at{" "}
              <a href="mailto:xresoinc@gmail.com" className={styles.link}>
                xresoinc@gmail.com
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          {/* ── 9. IT Act 2000 (India) ───────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              9. Information Technology Act, 2000 (India)
            </h2>
            <p>
              In accordance with the Information Technology Act, 2000 and the
              Information Technology (Reasonable Security Practices and Procedures
              and Sensitive Personal Data or Information) Rules, 2011:
            </p>
            <ul>
              <li>
                We implement reasonable security practices including encryption,
                access controls, and secure authentication.
              </li>
              <li>
                Sensitive personal data (passwords) is stored using industry-standard
                bcrypt hashing and is never stored in plaintext.
              </li>
            </ul>
            <p>
              <strong>Grievance Officer:</strong>
              <br />
              Aniket Mishra
              <br />
              Email:{" "}
              <a href="mailto:xresoinc@gmail.com" className={styles.link}>
                xresoinc@gmail.com
              </a>
              <br />
              Complaints will be acknowledged within 24 hours and resolved within
              30 days as per the IT Rules, 2011.
            </p>
          </section>

          {/* ── 10. Children ─────────────────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>10. Children&apos;s privacy</h2>
            <p>
              xreso is not directed at children under the age of 13. We do not
              knowingly collect personal information from children. If you believe
              a child under 13 has provided us with personal information, please
              contact us and we will promptly delete it.
            </p>
          </section>

          {/* ── 11. Changes ──────────────────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>11. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes
              will be communicated via a notice on the platform or by email.
              Continued use of xreso after changes constitutes acceptance of the
              updated policy.
            </p>
          </section>

          {/* ── 12. Contact ──────────────────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>12. Contact</h2>
            <p>
              For privacy inquiries, data subject requests, or complaints:
            </p>
            <p>
              Email:{" "}
              <a href="mailto:xresoinc@gmail.com" className={styles.link}>
                xresoinc@gmail.com
              </a>
              <br />
              GitHub:{" "}
              <a
                href="https://github.com/aniketmishra-0/xreso"
                className={styles.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                aniketmishra-0/xreso
              </a>
              <br />
              Response target: 30 days for formal requests, 1-3 business days for
              general inquiries.
            </p>
            <p>
              EU residents also have the right to lodge a complaint with a
              supervisory authority in their country of residence.
            </p>
          </section>

          <section className={styles.section}>
            <p>
              <Link href="/terms" className={styles.link}>
                Terms of Service
              </Link>{" "}
              ·{" "}
              <Link href="/dmca" className={styles.link}>
                DMCA Policy
              </Link>{" "}
              ·{" "}
              <Link href="/contact" className={styles.link}>
                Contact
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
