"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./CookieConsent.module.css";

const CONSENT_KEY = "xreso-cookie-consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small delay so it doesn't flash immediately on first paint
    const timer = setTimeout(() => {
      const consent = localStorage.getItem(CONSENT_KEY);
      if (!consent) {
        setVisible(true);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className={styles.banner}
      role="dialog"
      aria-label="Cookie consent"
      aria-describedby="cookie-consent-text"
    >
      <p className={styles.text} id="cookie-consent-text">
        We use cookies for essential functionality and analytics to improve your
        experience. By clicking &ldquo;Accept&rdquo;, you consent to our use of
        cookies. See our{" "}
        <Link href="/privacy">Privacy Policy</Link> for details.
      </p>
      <div className={styles.actions}>
        <button
          onClick={handleDecline}
          className={styles.declineBtn}
          type="button"
        >
          Decline
        </button>
        <button
          onClick={handleAccept}
          className={styles.acceptBtn}
          type="button"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
