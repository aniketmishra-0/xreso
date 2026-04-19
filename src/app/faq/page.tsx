import type { Metadata } from "next";
import Link from "next/link";
import { FAQ_ITEMS } from "@/lib/faq";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about xreso, our stack, and self-hosting.",
};

export default function FaqPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.badge}>FAQ</p>
        <h1 className={styles.title}>Answers built for developers.</h1>
        <p className={styles.subtitle}>
          Everything you need to understand what xreso solves, why it is built this
          way, and how to run it quickly.
        </p>
      </section>

      <section className={styles.panel}>
        {FAQ_ITEMS.map((item) => (
          <details key={item.id} className={styles.item}>
            <summary className={styles.question}>{item.question}</summary>
            <p className={styles.answer}>{item.answer}</p>
          </details>
        ))}
      </section>

      <section className={styles.actions}>
        <Link href="/home" className="btn btn-primary">
          Back to Home
        </Link>
        <a
          href="https://github.com/aniketmishra-0/xreso/issues/new/choose"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
        >
          Ask or Report on GitHub
        </a>
      </section>
    </div>
  );
}