"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { createPortal } from "react-dom";
import {
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
} from "react";
import {
  CONTRIBUTE_LOGIN_REQUIRED_MESSAGE,
} from "@/lib/contribute-copy";
import { trackContributeClick } from "@/lib/contribute-tracking";
import styles from "@/components/Navbar/Navbar.module.css";

type ContributeCtaAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  source: string;
};

export default function ContributeCtaAnchor({
  source,
  onClick,
  children,
  ...props
}: ContributeCtaAnchorProps) {
  const { data: session } = useSession();
  const [promptOpen, setPromptOpen] = useState(false);
  const [loginPromptHref, setLoginPromptHref] = useState("/login?reason=upload_login_required");

  const isAuthenticated = Boolean(session?.user);

  const fallbackCallbackPath = useMemo(() => {
    if (typeof props.href === "string") return props.href;
    return "/upload?mode=programming&focus=contribute";
  }, [props.href]);

  useEffect(() => {
    if (!promptOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPromptOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [promptOpen]);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    trackContributeClick(source);
    onClick?.(event);

    if (event.defaultPrevented || isAuthenticated) return;

    const isModifiedClick =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

    if (isModifiedClick) return;

    event.preventDefault();

    const callbackPath = event.currentTarget.getAttribute("href") || fallbackCallbackPath;
    setLoginPromptHref(
      `/login?callbackUrl=${encodeURIComponent(callbackPath)}&reason=upload_login_required`
    );
    setPromptOpen(true);
  };

  return (
    <>
      <a
        {...props}
        onClick={handleClick}
        data-track="contribute-click"
        data-source={source}
      >
        {children}
      </a>

      {promptOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className={styles.authPromptOverlay}
              onClick={() => setPromptOpen(false)}
              aria-hidden="true"
            >
              <div
                className={styles.authPromptDialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="contribute-login-title-anchor"
                aria-describedby="contribute-login-description-anchor"
                onClick={(event) => event.stopPropagation()}
              >
                <p className={styles.authPromptBadge}>Login Required</p>
                <h3 id="contribute-login-title-anchor" className={styles.authPromptTitle}>
                  Login First
                </h3>
                <p id="contribute-login-description-anchor" className={styles.authPromptText}>
                  {CONTRIBUTE_LOGIN_REQUIRED_MESSAGE}
                </p>
                <div className={styles.authPromptActions}>
                  <Link
                    href={loginPromptHref}
                    className={`btn btn-primary ${styles.authPromptPrimary}`}
                    onClick={() => setPromptOpen(false)}
                  >
                    Continue to Login
                  </Link>
                  <button
                    type="button"
                    className={`btn btn-ghost ${styles.authPromptSecondary}`}
                    onClick={() => setPromptOpen(false)}
                  >
                    Not Now
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
