import type { Metadata } from "next";
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
            and which controls are available to users.
          </p>
          <p className={styles.meta}>Effective date: April 15, 2026</p>
        </header>

        <div className={styles.sectionList}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Data we collect</h2>
            <ul>
              <li>Account profile information (name, email, role metadata).</li>
              <li>Submitted resources and moderation history.</li>
              <li>Operational analytics such as view and bookmark counts.</li>
              <li>Security logs required for fraud prevention and abuse response.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>How data is used</h2>
            <ul>
              <li>Operate authentication, uploads, search, and recommendations.</li>
              <li>Moderate content quality and enforce community rules.</li>
              <li>Maintain audit trails for admin actions and account security.</li>
              <li>Improve reliability, performance, and product decisions.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Storage and processors</h2>
            <p>
              Core application data is stored in the application database. Workbook
              exports for operational workflows are maintained in Excel, with
              OneDrive sync when configured and local fallback when unavailable.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Retention and deletion</h2>
            <p>
              Data is retained only as long as necessary for platform operations,
              legal obligations, and security response. Users may request account
              deletion and data review by emailing support.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Contact</h2>
            <p>
              Privacy requests can be sent to{" "}
              <a href="mailto:aniketmishra492@gmail.com" className={styles.link}>
                aniketmishra492@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
