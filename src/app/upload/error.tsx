"use client";

import Link from "next/link";

export default function UploadError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section style={{ minHeight: "60vh", padding: "120px 20px 40px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: 12 }}>
          Upload page could not be loaded
        </h1>
        <p style={{ marginBottom: 18, opacity: 0.82 }}>
          {error?.message || "An unexpected error occurred while rendering the upload page."}
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => reset()}>
            Retry
          </button>
          <Link href="/login?callbackUrl=%2Fupload&reason=upload_login_required" className="btn btn-secondary">
            Sign In
          </Link>
        </div>
      </div>
    </section>
  );
}
