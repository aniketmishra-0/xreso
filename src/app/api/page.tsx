import type { Metadata } from "next";
import Link from "next/link";
import styles from "../info-page.module.css";

export const metadata: Metadata = {
  title: "API Overview",
  description: "High-level API surface for xreso web and admin workflows.",
};

export default function ApiOverviewPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.kicker}>Developer</span>
          <h1 className={styles.title}>API Overview</h1>
          <p className={styles.description}>
            xreso uses App Router route handlers for web, admin, and auth flows.
            Most mutating endpoints require an authenticated session.
          </p>
          <p className={styles.meta}>Base path: /api/*</p>
        </header>

        <div className={styles.grid}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Auth and Account</h2>
            <ul>
              <li><span className={styles.code}>/api/auth/[...nextauth]</span></li>
              <li><span className={styles.code}>/api/register</span></li>
              <li><span className={styles.code}>/api/password-reset/request</span></li>
              <li><span className={styles.code}>/api/password-reset/confirm</span></li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Community Notes</h2>
            <ul>
              <li><span className={styles.code}>/api/upload</span></li>
              <li><span className={styles.code}>/api/notes</span></li>
              <li><span className={styles.code}>/api/files/[noteId]</span></li>
              <li><span className={styles.code}>/api/categories</span></li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Advanced Tracks</h2>
            <ul>
              <li><span className={styles.code}>/api/advanced-tracks</span></li>
              <li><span className={styles.code}>/api/advanced-tracks/resources</span></li>
              <li><span className={styles.code}>/api/advanced-tracks/resource/[resourceId]</span></li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Admin Operations</h2>
            <ul>
              <li><span className={styles.code}>/api/admin/stats</span></li>
              <li><span className={styles.code}>/api/admin/notes</span></li>
              <li><span className={styles.code}>/api/admin/storage-status</span></li>
              <li><span className={styles.code}>/api/admin/advanced-tracks</span></li>
            </ul>
          </section>
        </div>

        <p className={styles.callout}>
          Looking for policies and contribution requirements? Visit{" "}
          <Link href="/guidelines" className={styles.link}>
            Community Guidelines
          </Link>
          ,{" "}
          <Link href="/terms" className={styles.link}>
            Terms of Service
          </Link>
          , and{" "}
          <Link href="/privacy" className={styles.link}>
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
