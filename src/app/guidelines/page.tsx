import type { Metadata } from "next";
import Link from "next/link";
import styles from "../info-page.module.css";

export const metadata: Metadata = {
  title: "Community Guidelines",
  description: "How to contribute high-quality, safe, and respectful resources to xreso.",
};

export default function GuidelinesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.kicker}>Community</span>
          <h1 className={styles.title}>Community Guidelines</h1>
          <p className={styles.description}>
            xreso is built for practical learning resources. These guidelines keep
            the library useful, credible, and safe for everyone.
          </p>
          <p className={styles.meta}>Last updated: April 15, 2026</p>
        </header>

        <div className={styles.sectionList}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>1. Share useful, teachable resources</h2>
            <ul>
              <li>Contribute material that helps someone complete a learning step.</li>
              <li>Use clear titles and summaries so others can find content fast.</li>
              <li>Avoid duplicate contributions when a stronger version already exists.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Respect ownership and attribution</h2>
            <ul>
              <li>Contribute only content you have rights to share.</li>
              <li>Include accurate author credit and source links when applicable.</li>
              <li>Choose an explicit license whenever possible.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>3. Keep content safe and lawful</h2>
            <ul>
              <li>No malware, obfuscated downloads, phishing links, or deceptive redirects.</li>
              <li>No abusive, harassing, or discriminatory material.</li>
              <li>No illegal content or contributions that violate privacy rights.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>4. Moderation workflow</h2>
            <p>
              New submissions enter a review queue. Admins may approve, reject,
              request revisions, or remove content that breaks policy. Repeated
              abuse can lead to account restrictions.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>5. Reporting and escalation</h2>
            <p>
              To report policy violations, contact the moderation team through the{" "}
              <Link href="/contact" className={styles.link}>
                contact page
              </Link>
              . For copyright concerns, use the{" "}
              <Link href="/dmca" className={styles.link}>
                DMCA policy
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
