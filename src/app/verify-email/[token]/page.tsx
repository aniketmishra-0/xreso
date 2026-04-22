"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function VerifyEmailPage() {
  const params = useParams();
  const token = params.token as string;
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link.");
      return;
    }

    fetch("/api/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message || "Email verified successfully!");
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [token]);

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: "100%",
          textAlign: "center",
          padding: "3rem 2rem",
          borderRadius: 16,
          background: "var(--card-bg, rgba(255,255,255,0.03))",
          border: "1px solid var(--border, rgba(139,92,246,0.15))",
        }}
      >
        <Link href="/" style={{ display: "inline-block", marginBottom: "1.5rem" }}>
          <Image src="/logo.svg" alt="xreso" width={120} height={28} priority />
        </Link>

        {status === "loading" && (
          <>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
              Verifying your email...
            </h1>
            <p style={{ color: "var(--text-muted, #9B8FC2)" }}>
              Please wait while we verify your email address.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <p style={{ fontSize: "3rem", margin: "0 0 0.5rem" }}>✅</p>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
              Email Verified!
            </h1>
            <p style={{ color: "var(--text-muted, #9B8FC2)", marginBottom: "1.5rem" }}>
              {message}
            </p>
            <Link
              href="/login"
              className="btn btn-primary"
              style={{ display: "inline-block" }}
            >
              Sign In
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <p style={{ fontSize: "3rem", margin: "0 0 0.5rem" }}>❌</p>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
              Verification Failed
            </h1>
            <p style={{ color: "var(--text-muted, #9B8FC2)", marginBottom: "1.5rem" }}>
              {message}
            </p>
            <Link
              href="/login"
              className="btn btn-secondary"
              style={{ display: "inline-block" }}
            >
              Back to Sign In
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
