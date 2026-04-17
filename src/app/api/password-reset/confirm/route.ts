import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";
import { hashSync } from "bcryptjs";
import { logAuthEvent } from "@/lib/auth-events";
import { findActivePasswordResetToken, markPasswordResetTokenUsed } from "@/lib/password-reset";

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
    const { token, password } = await req.json();

    if (typeof token !== "string" || !token.trim()) {
      return NextResponse.json({ error: "Invalid reset token" }, { status: 400 });
    }

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const client = getClient();
    const resetRecord = await findActivePasswordResetToken(client, token.trim());

    if (!resetRecord) {
      return NextResponse.json({ error: "Reset link is invalid or expired" }, { status: 400 });
    }

    const userResult = await client.execute({
      sql: "SELECT id, password, email FROM users WHERE id = ? LIMIT 1",
      args: [resetRecord.user_id],
    });

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hashedPassword = hashSync(password, 10);
    await client.execute({
      sql: "UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?",
      args: [hashedPassword, resetRecord.user_id],
    });

    await markPasswordResetTokenUsed(client, resetRecord.id);

    const forwarded = req.headers.get("x-forwarded-for");
    const ipAddress = forwarded?.split(",")[0]?.trim() || "anonymous";
    const userEmail =
      typeof userResult.rows[0].email === "string" ? String(userResult.rows[0].email) : null;

    await logAuthEvent(
      {
        eventType: "password_reset_confirm",
        userId: resetRecord.user_id,
        email: userEmail,
        provider: "credentials",
        ipAddress,
      },
      client
    );

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("POST /api/password-reset/confirm error:", error);
    return NextResponse.json({ error: "Unable to reset password" }, { status: 500 });
  }
}
