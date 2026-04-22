import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";
import { hashSync } from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { logAuthEvent } from "@/lib/auth-events";
import { checkRateLimit, registerLimiter } from "@/lib/ratelimit";
import { createEmailVerificationToken } from "@/lib/email-verification";
import { sendEmailVerificationEmail, sendWelcomeEmail } from "@/lib/email";

function getClient() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("TURSO_DATABASE_URL is not configured");
  }

  return createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,128}$/;

// POST /api/register — Create new user
export async function POST(req: NextRequest) {
  try {
    const rateLimited = await checkRateLimit(req, registerLimiter);
    if (rateLimited) return rateLimited;

    const { name, email, password, avatar } = await req.json();
    const safeName = typeof name === "string" ? name.trim() : "";
    const safeEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const safePassword = typeof password === "string" ? password : "";

    if (!safeName || !safeEmail || !safePassword) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(safeEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    if (!STRONG_PASSWORD_REGEX.test(safePassword)) {
      return NextResponse.json(
        {
          error:
            "Password must be 10-128 characters and include uppercase, lowercase, number, and special character",
        },
        { status: 400 }
      );
    }

    let safeAvatar: string | null = null;
    if (typeof avatar === "string" && avatar.trim()) {
      const trimmed = avatar.trim();
      const isDataImage = /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(trimmed);
      if (!isDataImage) {
        return NextResponse.json(
          { error: "Avatar must be a valid image" },
          { status: 400 }
        );
      }
      const base64Payload = trimmed.split(",")[1] || "";
      const decodedSize = Buffer.from(base64Payload, "base64").length;
      if (decodedSize > 2 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Avatar image is too large" },
          { status: 400 }
        );
      }
      safeAvatar = trimmed;
    }

    const client = getClient();

    const existing = await client.execute({
      sql: "SELECT id FROM users WHERE lower(email) = lower(?)",
      args: [safeEmail],
    });

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const userId = uuidv4();
    const hashedPassword = hashSync(safePassword, 12);

    await client.execute({
      sql: "INSERT INTO users (id, name, email, password, avatar, role) VALUES (?, ?, ?, ?, ?, ?)",
      args: [userId, safeName, safeEmail, hashedPassword, safeAvatar, "user"],
    });

    const forwarded = req.headers.get("x-forwarded-for");
    const ipAddress = forwarded?.split(",")[0]?.trim() || "anonymous";

    await logAuthEvent(
      {
        eventType: "register",
        userId,
        email: safeEmail,
        provider: "credentials",
        ipAddress,
      },
      client
    );

    // Send email verification
    try {
      const verificationToken = await createEmailVerificationToken(client, userId);
      await sendEmailVerificationEmail(safeEmail, safeName, verificationToken);
    } catch (e) {
      console.error("[register] Failed to send verification email:", e);
      // Don't block registration if email sending fails
    }

    // Send welcome email (non-blocking)
    sendWelcomeEmail(safeEmail, safeName).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Account created! Please check your email to verify your address.",
      requiresVerification: true,
    });
  } catch (error) {
    console.error("POST /api/register error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}

