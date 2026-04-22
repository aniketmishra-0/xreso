"use client";

import Link from "next/link";
import styles from "./not-found.module.css";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className={styles.page}>
      <div className={styles.ambient} aria-hidden />

      <div className={styles.card}>
        <p className={styles.code}>500</p>
        <h1 className={styles.title}>Something went wrong.</h1>
        <p className={styles.description}>
          {error.digest
            ? `An unexpected error occurred (ref: ${error.digest}). We've been notified and are looking into it.`
            : "An unexpected error occurred. Please try again or let us know if this keeps happening."}
        </p>

        <div className={styles.actions}>
          <button onClick={reset} className="btn btn-primary">
            Try Again
          </button>
          <Link href="/" className="btn btn-secondary">
            Go to Home
          </Link>
        </div>

        <p className={styles.meta}>
          Need help?{" "}
          <a href="mailto:xresoinc@gmail.com">Contact support</a> or{" "}
          <a
            href="https://github.com/aniketmishra-0/xreso/issues/new/choose"
            target="_blank"
            rel="noopener noreferrer"
          >
            report on GitHub
          </a>
          .
        </p>
      </div>
    </section>
  );
}
