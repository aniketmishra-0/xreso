import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

// Create Redis client — uses env vars UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limiters for different endpoints
export const uploadLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"), // 5 uploads per hour
  analytics: true,
  prefix: "ratelimit:upload",
});

export const registerLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "1 h"), // 3 registrations per hour per IP
  analytics: true,
  prefix: "ratelimit:register",
});

export const loginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(8, "15 m"), // 8 login attempts per 15 minutes per identifier
  analytics: true,
  prefix: "ratelimit:login",
});

export const apiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"), // 60 requests per minute
  analytics: true,
  prefix: "ratelimit:api",
});

export async function isRateLimited(
  identifier: string,
  limiter: Ratelimit
): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return false;

  try {
    const { success } = await limiter.limit(identifier);
    return !success;
  } catch {
    // Fail-open if Redis is unavailable to avoid blocking auth unexpectedly.
    console.warn("Rate limiting unavailable - Redis error");
    return false;
  }
}

// Helper to get client identifier
function getIdentifier(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "anonymous";
  return ip;
}

// Rate limit check middleware
export async function checkRateLimit(
  req: NextRequest,
  limiter: Ratelimit
): Promise<NextResponse | null> {
  // Skip in development
  if (process.env.NODE_ENV === "development") return null;

  try {
    const identifier = getIdentifier(req);
    const { success, limit, reset, remaining } = await limiter.limit(identifier);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        }
      );
    }
  } catch {
    // If Redis is down, allow the request
    console.warn("Rate limiting unavailable — Redis error");
  }

  return null;
}
