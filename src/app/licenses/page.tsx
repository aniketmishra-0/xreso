import type { Metadata } from "next";
import styles from "../info-page.module.css";

export const metadata: Metadata = {
  title: "Licenses",
  description: "Open-source software license and content licensing model for xreso.",
};

export default function LicensesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.kicker}>Licensing</span>
          <h1 className={styles.title}>Licenses</h1>
          <p className={styles.description}>
            xreso combines open-source platform code with community-contributed
            educational resources. Each layer has a separate license scope.
          </p>
          <p className={styles.meta}>Reference index</p>
        </header>

        <div className={styles.sectionList}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Platform source code</h2>
            <p>
              The xreso codebase is licensed under the MIT License unless stated
              otherwise in specific files.
            </p>
            <p>
              Canonical file: <a href="https://github.com/aniketmishra-0/xreso/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className={styles.link}>LICENSE</a>
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>User-contributed resources</h2>
            <p>
              Contributors retain ownership of their content. Reuse rights depend
              on the license selected by the contributor during contribution (for
              example CC-BY, CC-BY-SA, or similar).
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Third-party packages</h2>
            <p>
              Dependencies are governed by their own licenses. Review the
              repository lockfile and package metadata for complete attribution.
            </p>
          </section>
        </div>

        <p className={styles.callout}>
          If you need a consolidated third-party notice export for compliance,
          contact support and include your deployment context.
        </p>
      </div>
    </div>
  );
}
