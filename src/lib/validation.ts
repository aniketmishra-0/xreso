import { z } from "zod";

// Input validation schemas for security

export const uploadFormSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().min(1).max(2000).trim(),
  category: z.string().min(1).max(50).trim(),
  authorCredit: z.string().min(1).max(100).trim(),
  tags: z.string().max(500).trim().optional(),
  sourceUrl: z.string().url().max(500).optional().or(z.literal("")),
  resourceUrl: z.string().url().max(500).optional().or(z.literal("")),
  licenseType: z.enum(["CC-BY-4.0", "CC-BY-SA-4.0", "CC-BY-NC-4.0", "MIT", "Apache-2.0", "Proprietary"]).optional(),
  uploadMode: z.enum(["file", "link"]).optional(),
});

export const noteIdSchema = z.string().uuid();

export const emailSchema = z.string().email().max(254).toLowerCase().trim();

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password too long")
  .regex(/[A-Z]/, "Must contain uppercase letter")
  .regex(/[a-z]/, "Must contain lowercase letter")
  .regex(/[0-9]/, "Must contain number");

// Sanitize string for safe output
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove < and > to prevent HTML injection
    .trim();
}

// Validate and sanitize tags
export function sanitizeTags(tags: string): string[] {
  return tags
    .split(",")
    .map((tag) =>
      tag
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\-]/g, "") // Only allow alphanumeric and hyphens
        .slice(0, 30)
    )
    .filter((tag) => tag.length > 0);
}
