import Link from "next/link";
import ContributeCtaAnchor from "@/components/ContributeCtaAnchor";
import styles from "./not-found.module.css";

const GITHUB_ISSUES_URL = "https://github.com/aniketmishra-0/xreso/issues/new/choose";
const CONTRIBUTING_URL =
  "https://github.com/aniketmishra-0/xreso/blob/main/CONTRIBUTING.md";
const QUICK_LINKS = [
  { href: "/browse", label: "Browse Notes" },
  { href: "/tracks/library", label: "Cloud Native Tracks" },
  { href: "/guidelines", label: "Community Guidelines" },
  { href: "/contact", label: "Contact Support" },
];

export default function NotFound() {
  return (
    <section className={styles.page}>
      <div className={styles.ambient} aria-hidden />

      <div className={styles.card}>
        <p className={styles.code}>404</p>
        <h1 className={styles.title}>This route is off the map.</h1>
        <p className={styles.description}>
          Lost? Help us map this area by reporting a bug or contributing.
        </p>

        <div className={styles.quickLinks}>
          {QUICK_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className={styles.quickLink}>
              {item.label}
            </Link>
          ))}
        </div>

        <div className={styles.actions}>
          <Link href="/" className="btn btn-primary">
            Go to Home
          </Link>
          <ContributeCtaAnchor
            href={GITHUB_ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            source="not-found-report"
          >
            Report or Contribute
          </ContributeCtaAnchor>
        </div>

        <p className={styles.meta}>
          Prefer shipping code? Start with the{" "}
          <a href={CONTRIBUTING_URL} target="_blank" rel="noopener noreferrer">
            contributor guide
          </a>
          .
        </p>
      </div>
    </section>
  );
}
