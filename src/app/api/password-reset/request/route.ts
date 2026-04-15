import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/email";

const DB_PATH = path.join(process.cwd(), "xreso.db");

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const db = new Database(DB_PATH);

    const user = db
      .prepare("SELECT id, name, email FROM users WHERE lower(email) = lower(?) LIMIT 1")
      .get(normalizedEmail) as { id: string; name: string; email: string } | undefined;

    if (user) {
      const token = createPasswordResetToken(db, user.id);
      await sendPasswordResetEmail(user.email, user.name || "there", token);

      if (process.env.NODE_ENV !== "production") {
        db.close();

        return NextResponse.json({
          success: true,
          message: "If an account exists for that email, a reset link has been sent.",
          resetLink: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password/${token}`,
        });
      }
    }

    db.close();

    return NextResponse.json({
      success: true,
      message: "If an account exists for that email, a reset link has been sent.",
    });
  } catch (error) {
    console.error("POST /api/password-reset/request error:", error);
    return NextResponse.json({ error: "Unable to process reset request" }, { status: 500 });
  }
}
