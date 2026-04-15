import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import { hashSync } from "bcryptjs";
import path from "path";
import { findActivePasswordResetToken, markPasswordResetTokenUsed } from "@/lib/password-reset";

const DB_PATH = path.join(process.cwd(), "xreso.db");

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (typeof token !== "string" || !token.trim()) {
      return NextResponse.json({ error: "Invalid reset token" }, { status: 400 });
    }

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const db = new Database(DB_PATH);
    const resetRecord = findActivePasswordResetToken(db, token.trim());

    if (!resetRecord) {
      db.close();
      return NextResponse.json({ error: "Reset link is invalid or expired" }, { status: 400 });
    }

    const user = db
      .prepare("SELECT id, password FROM users WHERE id = ? LIMIT 1")
      .get(resetRecord.user_id) as { id: string; password: string | null } | undefined;

    if (!user) {
      db.close();
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hashedPassword = hashSync(password, 10);
    db.prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?").run(
      hashedPassword,
      user.id
    );

    markPasswordResetTokenUsed(db, resetRecord.id);
    db.close();

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("POST /api/password-reset/confirm error:", error);
    return NextResponse.json({ error: "Unable to reset password" }, { status: 500 });
  }
}
