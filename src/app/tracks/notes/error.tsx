"use client";

import Link from "next/link";

export default function TracksNotesError({
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
          Advanced notes page failed to render
        </h1>
        <p style={{ marginBottom: 18, opacity: 0.82 }}>
          {error?.message || "An unexpected error occurred on this page."}
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => reset()}>
            Retry
          </button>
          <Link href="/tracks/library" className="btn btn-secondary">
            Browse Tracks
          </Link>
        </div>
      </div>
    </section>
  );
}
