import { NextRequest } from "next/server";
import { SITE_URL } from "@/lib/site";

/**
 * Validate that a mutating request (POST/PUT/PATCH/DELETE) originates
 * from the same origin. This prevents cross-site request forgery on
 * custom API routes that aren't covered by NextAuth's built-in CSRF.
 *
 * Returns true if the request origin is trusted, false otherwise.
 */
export function validateOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // At least one header must be present for mutating requests
  if (!origin && !referer) return false;

  const siteOrigin = new URL(SITE_URL).origin;
  const allowedOrigins = [siteOrigin];

  // Allow localhost in development
  if (process.env.NODE_ENV === "development") {
    allowedOrigins.push(
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000"
    );
  }

  // Check Origin header first (most reliable)
  if (origin) {
    return allowedOrigins.includes(origin);
  }

  // Fall back to Referer header
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      return allowedOrigins.includes(refererOrigin);
    } catch {
      return false;
    }
  }

  return false;
}
