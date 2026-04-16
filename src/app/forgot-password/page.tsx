"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import styles from "./page.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetLink, setResetLink] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setResetLink("");
    setLoading(true);

    try {
      const response = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "Could not start password reset");
        return;
      }

      setMessage(payload.message || "Check your email for a reset link.");
      if (typeof payload.resetLink === "string") {
        setResetLink(payload.resetLink);
      }
      setEmail("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <Link href="/login" className={styles.logoLink}>
              <Logo className={styles.logoIcon} />
              <span className={styles.logoText}>xreso</span>
            </Link>
            <h1 className={styles.title}>Forgot password</h1>
            <p className={styles.subtitle}>Enter your email and we will send a reset link.</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.error}>{error}</div>}
            {message && <div className={styles.success}>{message}</div>}
            {resetLink && (
              <div className={styles.linkBox}>
                <p className={styles.linkTitle}>Dev fallback link</p>
                <a href={resetLink} className={styles.linkValue}>{resetLink}</a>
                <button
                  type="button"
                  className={`btn btn-secondary btn-sm ${styles.copyBtn}`}
                  onClick={async () => {
                    await navigator.clipboard.writeText(resetLink);
                  }}
                >
                  Copy link
                </button>
              </div>
            )}

            <div className="input-group">
              <label htmlFor="email" className="input-label">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <button type="submit" className={`btn btn-primary btn-lg ${styles.submitBtn}`} disabled={loading}>
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>

          <div className={styles.footerLink}>
            <Link href="/login">Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
