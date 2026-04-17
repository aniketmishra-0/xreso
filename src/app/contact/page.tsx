import type { Metadata } from "next";
import Link from "next/link";
import styles from "../info-page.module.css";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get support for account, moderation, integrations, and legal requests.",
};

export default function ContactPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.kicker}>Support</span>
          <h1 className={styles.title}>Contact xreso</h1>
          <p className={styles.description}>
            Reach the right team quickly by using the contact channels below.
          </p>
          <p className={styles.meta}>Response target: 1-3 business days</p>
        </header>

        <div className={styles.grid}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>General Support</h2>
            <p>
              For account issues, login trouble, broken links, and upload errors.
            </p>
            <p>
              Email: <a href="mailto:xresoinc@gmail.com" className={styles.link}>xresoinc@gmail.com</a>
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Moderation Team</h2>
            <p>
              Report policy violations, spam, abuse, or unsafe resources.
            </p>
            <p>
              Subject line: <span className={styles.code}>[Moderation] &lt;issue&gt;</span>
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Legal Requests</h2>
            <p>
              For copyright claims, DMCA notices, and legal correspondence.
            </p>
            <p>
              Start here:{" "}
              <Link href="/dmca" className={styles.link}>
                DMCA policy
              </Link>
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Open Source Collaboration</h2>
            <p>
              Feature proposals, bug reports, and contribution ideas.
            </p>
            <p>
              GitHub Issues: <a href="https://github.com/aniketmishra-0/xreso/issues/new/choose" target="_blank" rel="noopener noreferrer" className={styles.link}>Open an issue</a>
            </p>
          </section>
        </div>

        <p className={styles.callout}>
          Include clear reproduction steps, expected behavior, and screenshots when
          reporting technical issues. This helps us resolve requests faster.
        </p>
      </div>
    </div>
  );
}
