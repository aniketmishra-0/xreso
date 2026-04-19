import Link from "next/link";

export default function McqPage() {
  return (
    <section style={{ minHeight: "calc(100vh - var(--nav-height))", padding: "calc(var(--nav-height) + 24px) 20px 32px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", border: "1px solid var(--border-secondary)", borderRadius: "var(--radius-xl)", padding: "24px", background: "var(--bg-surface)" }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-tertiary)", fontWeight: 700 }}>
          MCQ PRACTICE
        </p>
        <h1 style={{ margin: "10px 0 8px" }}>MCQ Module</h1>
        <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          This section is ready for quiz integration. You can now route users here from Home and
          add topic-wise question sets next.
        </p>

        <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/categories" className="btn btn-secondary btn-sm">Pick Topic</Link>
          <Link href="/browse" className="btn btn-ghost btn-sm">Back to Library</Link>
        </div>
      </div>
    </section>
  );
}
