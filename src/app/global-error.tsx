"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          background: "#0F0A1A",
          color: "#F0EEFF",
          textAlign: "center",
          padding: "2rem",
          margin: 0,
        }}
      >
        <div>
          <p
            style={{
              fontSize: "5rem",
              fontWeight: 900,
              margin: 0,
              background: "linear-gradient(135deg, #8B5CF6, #F97316)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              lineHeight: 1,
            }}
          >
            500
          </p>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#F0EEFF",
              margin: "1rem 0 0.5rem",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              color: "#9B8FC2",
              maxWidth: 420,
              margin: "0 auto 2rem",
              fontSize: "0.95rem",
              lineHeight: 1.6,
            }}
          >
            An unexpected error occurred. Our team has been notified. Please try
            again or return to the home page.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                background: "linear-gradient(135deg, #8B5CF6, #F97316)",
                color: "white",
                border: "none",
                padding: "12px 28px",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.9rem",
              }}
            >
              Try Again
            </button>
            <a
              href="/"
              style={{
                background: "rgba(139, 92, 246, 0.1)",
                color: "#A78BFA",
                border: "1px solid rgba(139, 92, 246, 0.3)",
                padding: "12px 28px",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "0.9rem",
              }}
            >
              Go Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
