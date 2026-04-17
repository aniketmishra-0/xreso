import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

function buildContentSecurityPolicy() {
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  if (!isProduction) {
    scriptSrc.push("'unsafe-eval'");
  }

  const connectSrc = [
    "'self'",
    "https://*.r2.cloudflarestorage.com",
    "https://*.amazonaws.com",
    "https://graph.microsoft.com",
    "https://*.sharepoint.com",
    "https://*.api.onedrive.com",
    "https://login.microsoftonline.com",
    "https://www.googleapis.com",
    "https://api.github.com",
    "https://*.linkedin.com",
  ];

  if (!isProduction) {
    connectSrc.push(
      "http://localhost:*",
      "http://127.0.0.1:*",
      "ws://localhost:*",
      "ws://127.0.0.1:*"
    );
  }

  const policy = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
    "script-src " + scriptSrc.join(" ") + " https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com https://*.amazonaws.com https://avatars.githubusercontent.com https://lh3.googleusercontent.com",
    "media-src 'self' blob: https://*.r2.cloudflarestorage.com https://*.amazonaws.com",
    "worker-src 'self' blob:",
    "connect-src " + connectSrc.join(" "),
    "frame-src 'self' https://drive.google.com https://docs.google.com",
  ];

  if (isProduction) {
    policy.push("upgrade-insecure-requests");
  }

  return policy.join("; ");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // Image optimization for remote images (R2/S3)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com", // GitHub OAuth avatars
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Google OAuth avatars
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-site",
          },
          {
            key: "Origin-Agent-Cluster",
            value: "?1",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), gyroscope=(), accelerometer=()",
          },
          {
            key: "Content-Security-Policy",
            value: buildContentSecurityPolicy(),
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
