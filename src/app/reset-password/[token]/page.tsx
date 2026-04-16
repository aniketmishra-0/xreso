"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import styles from "./page.module.css";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams();
  const token = String(params?.token || "");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "Could not reset password");
        return;
      }

      setMessage(payload.message || "Password updated successfully.");
      setTimeout(() => router.push("/login"), 1200);
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
            <h1 className={styles.title}>Reset password</h1>
            <p className={styles.subtitle}>Choose a new password for your account.</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.error}>{error}</div>}
            {message && <div className={styles.success}>{message}</div>}

            <div className="input-group">
              <label htmlFor="password" className="input-label">New password</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="confirmPassword" className="input-label">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                className="input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={6}
                required
              />
            </div>

            <button type="submit" className={`btn btn-primary btn-lg ${styles.submitBtn}`} disabled={loading}>
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
