import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";
import { logAuthEvent } from "@/lib/auth-events";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/email";

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

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const client = getClient();

    const result = await client.execute({
      sql: "SELECT id, name, email FROM users WHERE lower(email) = lower(?) LIMIT 1",
      args: [normalizedEmail],
    });

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const token = await createPasswordResetToken(client, String(user.id));
      await sendPasswordResetEmail(String(user.email), String(user.name || "there"), token);

      const forwarded = req.headers.get("x-forwarded-for");
      const ipAddress = forwarded?.split(",")[0]?.trim() || "anonymous";
      await logAuthEvent(
        {
          eventType: "password_reset_request",
          userId: String(user.id),
          email: String(user.email),
          provider: "credentials",
          ipAddress,
        },
        client
      );

      if (process.env.NODE_ENV !== "production") {
        return NextResponse.json({
          success: true,
          message: "If an account exists for that email, a reset link has been sent.",
          resetLink: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password/${token}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists for that email, a reset link has been sent.",
    });
  } catch (error) {
    console.error("POST /api/password-reset/request error:", error);
    return NextResponse.json({ error: "Unable to process reset request" }, { status: 500 });
  }
}
