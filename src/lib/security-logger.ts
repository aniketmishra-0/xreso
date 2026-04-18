// Security-focused logger - only logs in development or for critical errors
const isDev = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

export const securityLogger = {
  // Always log security events (auth, access violations)
  security: (message: string, meta?: Record<string, unknown>) => {
    console.log(`[SECURITY] ${message}`, meta ? JSON.stringify(meta) : "");
  },

  // Only log in development
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (isDev || isTest) {
      console.log(`[DEBUG] ${message}`, meta || "");
    }
  },

  // Always log errors (but sanitize sensitive data)
  error: (message: string, error?: unknown) => {
    // Don't log full error objects in production to avoid leaking sensitive info
    if (isDev) {
      console.error(`[ERROR] ${message}`, error);
    } else {
      // In production, only log error message, not stack trace
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[ERROR] ${message}: ${errorMessage}`);
    }
  },

  // Audit events (always logged)
  audit: (event: string, userId: string, details: Record<string, unknown>) => {
    console.log(`[AUDIT] ${event} | User: ${userId} | ${JSON.stringify(details)}`);
  },
};

// Sanitize user input to prevent log injection
export function sanitizeLogInput(input: string): string {
  return input
    .replace(/[\n\r]/g, "") // Remove newlines
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""); // Remove control chars
}
