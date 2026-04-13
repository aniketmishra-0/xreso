import styles from "./page.module.css";

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.badge}>Legal</span>
          <h1 className={styles.title}>Terms of Service</h1>
          <p className={styles.lastUpdated}>Last Updated: April 12, 2026</p>
        </header>

        <div className={styles.content}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>1. Acceptance of Terms</h2>
            <p>
              By accessing or using xreso (&ldquo;the Platform&rdquo;), you agree to be bound
              by these Terms of Service. If you do not agree to these terms,
              please do not use the Platform.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>2. User Accounts</h2>
            <p>
              To upload content, you must create an account. You are responsible
              for maintaining the confidentiality of your account credentials and
              for all activities under your account.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              3. User-Generated Content & Copyright
            </h2>
            <div className={styles.highlight}>
              <h3>You Retain Your Copyright</h3>
              <p>
                When you upload content to xreso, <strong>you retain full
                copyright ownership</strong> of your work. We do not claim
                ownership of any content you submit.
              </p>
            </div>
            <p>
              By uploading, you grant xreso a non-exclusive, worldwide,
              royalty-free license to host, display, distribute, and make
              available your content on the Platform. This license is solely for
              the purpose of operating and promoting xreso.
            </p>
            <p>
              You may choose a Creative Commons license for your uploads, which
              determines how other users may use your content beyond the
              Platform.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>4. Content Guidelines</h2>
            <p>You agree not to upload content that:</p>
            <ul>
              <li>Infringes on the copyright or intellectual property of others</li>
              <li>Contains malicious code, spam, or misleading information</li>
              <li>Is offensive, defamatory, or violates any law</li>
              <li>
                Impersonates another person or misrepresents authorship
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>5. DMCA & Copyright Claims</h2>
            <p>
              We respect intellectual property rights. If you believe your
              copyrighted work has been uploaded without permission, you may file
              a DMCA takedown notice. We will investigate and remove infringing
              content promptly.
            </p>
            <p>
              Contact us at{" "}
              <a href="mailto:legal@xreso.dev" className={styles.link}>
                legal@xreso.dev
              </a>{" "}
              with your copyright complaint.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>6. Content Moderation</h2>
            <p>
              All uploaded content goes through a moderation process before being
              made publicly available. We reserve the right to remove any content
              that violates these terms or our community guidelines.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>7. Disclaimer</h2>
            <p>
              xreso is provided &ldquo;as is&rdquo; without warranties of any kind. We do
              not guarantee the accuracy, completeness, or usefulness of any
              user-generated content on the Platform.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>8. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the
              Platform after changes constitutes acceptance of the new terms. We
              will notify users of significant changes via email or a prominent
              notice on the Platform.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>9. Contact</h2>
            <p>
              If you have questions about these Terms, please contact us at{" "}
              <a href="mailto:hello@xreso.dev" className={styles.link}>
                hello@xreso.dev
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
