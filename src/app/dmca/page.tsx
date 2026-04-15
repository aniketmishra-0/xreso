import type { Metadata } from "next";
import styles from "../info-page.module.css";

export const metadata: Metadata = {
  title: "DMCA Policy",
  description: "How to submit takedown and counter-notice requests for copyrighted content.",
};

export default function DmcaPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.kicker}>Legal</span>
          <h1 className={styles.title}>DMCA Policy</h1>
          <p className={styles.description}>
            xreso respects intellectual property rights and responds to valid DMCA
            notices as required by law.
          </p>
          <p className={styles.meta}>Updated: April 15, 2026</p>
        </header>

        <div className={styles.sectionList}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>How to submit a takedown notice</h2>
            <p>Your notice should include:</p>
            <ol>
              <li>Your full name and contact information.</li>
              <li>Identification of the copyrighted work.</li>
              <li>The exact URL(s) of allegedly infringing content.</li>
              <li>A statement of good faith belief in unauthorized use.</li>
              <li>A statement under penalty of perjury that your claim is accurate.</li>
              <li>Your physical or electronic signature.</li>
            </ol>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Counter-notice process</h2>
            <p>
              If your content was removed by mistake, you may send a valid
              counter-notice. If no court action is filed by the complainant within
              the legal window, access may be restored.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Where to send notices</h2>
            <p>
              Email: <a href="mailto:aniketmishra492@gmail.com" className={styles.link}>aniketmishra492@gmail.com</a>
            </p>
            <p>
              Subject line: <span className={styles.code}>[DMCA Notice]</span> or{" "}
              <span className={styles.code}>[DMCA Counter-Notice]</span>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
