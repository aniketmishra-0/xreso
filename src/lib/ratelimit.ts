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

// Simple in-memory rate limiter for when Redis is unavailable
const memoryStore = new Map<string, { count: number; resetTime: number }>();

function checkMemoryLimit(identifier: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const key = identifier;
  const record = memoryStore.get(key);
  
  if (!record || now > record.resetTime) {
    memoryStore.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }
  
  if (record.count >= maxRequests) {
    return true;
  }
  
  record.count++;
  return false;
}

export async function isRateLimited(
  identifier: string,
  limiter: Ratelimit | null
): Promise<boolean> {
  const isDev = process.env.NODE_ENV === "development";
  
  // In development, skip rate limiting
  if (isDev && !limiter) return false;

  try {
    if (limiter) {
      const { success } = await limiter.limit(identifier);
      return !success;
    }
    
    // Fallback to memory-based limiting if Redis unavailable
    // This prevents complete bypass of rate limiting
    return checkMemoryLimit(identifier, 10, 60 * 1000); // 10 requests per minute fallback
  } catch {
    // Security: Don't fail open - use memory fallback instead
    console.error("Rate limiting Redis error - using memory fallback");
    return checkMemoryLimit(identifier, 10, 60 * 1000);
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
  const isDev = process.env.NODE_ENV === "development";
  
  // Skip in development only
  if (isDev && !limiter) return null;

  try {
    if (limiter) {
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
    } else {
      // Use memory fallback if Redis not configured
      const identifier = getIdentifier(req);
      if (checkMemoryLimit(identifier, 60, 60 * 1000)) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        );
      }
    }
  } catch {
    // Security: Use memory fallback instead of failing open
    console.error("Rate limiting error - using memory fallback");
    const identifier = getIdentifier(req);
    if (checkMemoryLimit(identifier, 30, 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
  }

  return null;
}
