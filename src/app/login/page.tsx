"use client";

import { Suspense, useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { FaGithub, FaGoogle, FaLinkedinIn } from "react-icons/fa";
import styles from "./page.module.css";

type SocialProviderConfig = {
  id: string;
  name: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const SOCIAL_PROVIDERS: SocialProviderConfig[] = [
  { id: "google", name: "Google", Icon: FaGoogle },
  { id: "github", name: "GitHub", Icon: FaGithub },
  { id: "linkedin", name: "LinkedIn", Icon: FaLinkedinIn },
];

function getSafeCallbackUrl(rawCallbackUrl: string | null) {
  if (!rawCallbackUrl || !rawCallbackUrl.startsWith("/")) {
    return "/";
  }

  try {
    const baseUrl = new URL("https://xreso.local");
    const resolvedUrl = new URL(rawCallbackUrl, baseUrl);

    if (resolvedUrl.origin !== baseUrl.origin) {
      return "/";
    }

    return `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
  } catch {
    return "/";
  }
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl"));
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", avatar: "" });
  const [configuredProviderIds, setConfiguredProviderIds] = useState<string[]>([]);
  const [socialLoadingProvider, setSocialLoadingProvider] = useState<string | null>(
    null
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);


  const hasSocialProviders = configuredProviderIds.length > 0;
  const activeSocialProviders = SOCIAL_PROVIDERS.filter((provider) =>
    configuredProviderIds.includes(provider.id)
  );

  useEffect(() => {
    let mounted = true;

    getProviders()
      .then((providers) => {
        if (!mounted || !providers) return;

        const preferredOrder = ["google", "github", "linkedin"];
        const list = preferredOrder
          .map((id) => providers[id])
          .filter((provider): provider is NonNullable<typeof provider> => Boolean(provider))
          .map((provider) => provider.id);

        setConfiguredProviderIds(list);
      })
      .catch(() => {
        setConfiguredProviderIds([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleOAuthSignIn = async (providerId: string) => {
    if (!configuredProviderIds.includes(providerId)) {
      return;
    }

    setError("");
    setSocialLoadingProvider(providerId);

    try {
      await signIn(providerId, { callbackUrl });
    } catch {
      setError("Social sign-in failed. Please try again.");
      setSocialLoadingProvider(null);
    }
  };

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

      router.push(callbackUrl);
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
            <Link href="/home" className={styles.logoLink}>
              <span className={styles.logoText}>xreso</span>
            </Link>
            <p className={styles.eyebrow}>Account Access</p>
            <h1 className={styles.title}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </h1>
            <p className={styles.subtitle}>
              {mode === "login"
                ? "Sign in to contribute, bookmark, and manage your notes"
                : "Join the community and start sharing your notes"}
            </p>
          </div>

          {/* Tab Toggle */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${mode === "login" ? styles.tabActive : ""}`}
              type="button"
              onClick={() => { setMode("login"); setError(""); }}
            >
              Sign In
            </button>
            <button
              className={`${styles.tab} ${mode === "register" ? styles.tabActive : ""}`}
              type="button"
              onClick={() => { setMode("register"); setError(""); }}
            >
              Create Account
            </button>
          </div>

          <div className={styles.socialSection}>
            <div className={styles.socialButtons}>
              {activeSocialProviders.map((provider) => {
                const isDisabled = loading || socialLoadingProvider !== null;
                const providerClassName =
                  provider.id === "google"
                    ? styles.socialBtnGoogle
                    : provider.id === "github"
                    ? styles.socialBtnGitHub
                    : styles.socialBtnLinkedIn;

                return (
                  <button
                    key={provider.id}
                    type="button"
                    className={`${styles.socialBtn} ${providerClassName}`}
                    disabled={isDisabled}
                    onClick={() => {
                      void handleOAuthSignIn(provider.id);
                    }}
                  >
                    <provider.Icon className={styles.socialIcon} />
                    <span>
                      {socialLoadingProvider === provider.id
                        ? "..."
                        : provider.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {hasSocialProviders ? (
              <div className={styles.divider}>
                <span>or continue with email</span>
              </div>
            ) : (
              <div className={styles.socialHintBlock}>
                <p className={styles.socialHint}>
                  Social sign-in is currently unavailable. Use email and password, or
                  configure OAuth providers in the environment settings.
                </p>
                <p className={styles.socialTip}>
                  After adding provider credentials, restart the server to activate them.
                </p>
              </div>
            )}
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
                minLength={mode === "register" ? 10 : undefined}
                title={
                  mode === "register"
                    ? "Use 10+ characters with uppercase, lowercase, number, and special character"
                    : undefined
                }
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

            <p className={styles.footnote}>
              Secure session, encrypted credentials, and role-based access controls.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function LoginPageFallback() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.card} aria-busy="true" style={{ minHeight: 520 }} />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
