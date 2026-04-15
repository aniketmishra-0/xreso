import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const hasRedisConfig = Boolean(redisUrl && redisToken);

// Only initialize Redis when both Upstash secrets are present.
const redis = hasRedisConfig ? new Redis({ url: redisUrl!, token: redisToken! }) : null;

function createLimiter(config: {
  prefix: string;
  maxRequests: number;
  window: `${number} ${"s" | "m" | "h" | "d"}`;
}): Ratelimit | null {
  if (!redis) return null;

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.maxRequests, config.window),
    analytics: true,
    prefix: config.prefix,
  });
}

// Rate limiters for different endpoints
export const uploadLimiter = createLimiter({
  prefix: "ratelimit:upload",
  maxRequests: 5, // 5 uploads per hour
  window: "1 h",
});

export const registerLimiter = createLimiter({
  prefix: "ratelimit:register",
  maxRequests: 3, // 3 registrations per hour per IP
  window: "1 h",
});

export const loginLimiter = createLimiter({
  prefix: "ratelimit:login",
  maxRequests: 8, // 8 login attempts per 15 minutes per identifier
  window: "15 m",
});

export const apiLimiter = createLimiter({
  prefix: "ratelimit:api",
  maxRequests: 60, // 60 requests per minute
  window: "1 m",
});

export async function isRateLimited(
  identifier: string,
  limiter: Ratelimit | null
): Promise<boolean> {
  if (process.env.NODE_ENV === "development" || !limiter) return false;

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
  limiter: Ratelimit | null
): Promise<NextResponse | null> {
  // Skip in development
  if (process.env.NODE_ENV === "development" || !limiter) return null;

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
