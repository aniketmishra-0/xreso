"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", avatar: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) {
      setForm((prev) => ({ ...prev, avatar: "" }));
      return;
    }

    if (!selected.type.startsWith("image/")) {
      setError("Please choose an image file for avatar");
      return;
    }

    if (selected.size > 2 * 1024 * 1024) {
      setError("Avatar image must be under 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setForm((prev) => ({ ...prev, avatar: result }));
      setError("");
    };
    reader.onerror = () => setError("Could not read image. Try another file.");
    reader.readAsDataURL(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
            avatar: form.avatar || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Registration failed");
          setLoading(false);
          return;
        }
        // Auto-login after registration
      }

      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
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
            <Link href="/" className={styles.logoLink}>
              <span className={styles.logoText}>xreso</span>
            </Link>
            <h1 className={styles.title}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </h1>
            <p className={styles.subtitle}>
              {mode === "login"
                ? "Sign in to upload, bookmark, and manage your notes"
                : "Join the community and start sharing your notes"}
            </p>
          </div>

          {/* Tab Toggle */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${mode === "login" ? styles.tabActive : ""}`}
              onClick={() => { setMode("login"); setError(""); }}
            >
              Sign In
            </button>
            <button
              className={`${styles.tab} ${mode === "register" ? styles.tabActive : ""}`}
              onClick={() => { setMode("register"); setError(""); }}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.error}>{error}</div>}

            {mode === "register" && (
              <>
                <div className="input-group">
                  <label htmlFor="name" className="input-label">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    className="input"
                    placeholder="Aniket Mishra"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="avatar" className="input-label">
                    Profile Photo (optional)
                  </label>
                  <div className={styles.avatarUploadRow}>
                    <div className={styles.avatarPreview} aria-hidden="true">
                      {form.avatar ? (
                        <Image
                          src={form.avatar}
                          alt="Avatar preview"
                          className={styles.avatarPreviewImage}
                          width={52}
                          height={52}
                          unoptimized
                        />
                      ) : (
                        <span>{form.name?.charAt(0).toUpperCase() || "U"}</span>
                      )}
                    </div>
                    <input
                      type="file"
                      id="avatar"
                      accept="image/*"
                      className={styles.avatarInput}
                      onChange={handleAvatarChange}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="input-group">
              <label htmlFor="email" className="input-label">
                Email
              </label>
              <input
                type="email"
                id="email"
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="password" className="input-label">
                Password
              </label>
              <input
                type="password"
                id="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
              />
            </div>

            {mode === "login" && (
              <div className={styles.forgotRow}>
                <Link href="/forgot-password" className={styles.forgotLink}>
                  Forgot password?
                </Link>
              </div>
            )}

            <button
              type="submit"
              className={`btn btn-primary btn-lg ${styles.submitBtn}`}
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Sign In"
                : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
