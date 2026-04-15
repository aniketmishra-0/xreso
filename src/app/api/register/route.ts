import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import { hashSync } from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { appendUserToExcel } from "@/lib/excel";
import { checkRateLimit, registerLimiter } from "@/lib/ratelimit";

const DB_PATH = path.join(process.cwd(), "xreso.db");
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

    const sqlite = new Database(DB_PATH);

    const existing = sqlite
      .prepare("SELECT id FROM users WHERE lower(email) = lower(?)")
      .get(safeEmail) as { id: string } | undefined;

    if (existing) {
      sqlite.close();
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const userId = uuidv4();
    const hashedPassword = hashSync(safePassword, 12);

    sqlite
      .prepare(
        "INSERT INTO users (id, name, email, password, avatar, role) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(userId, safeName, safeEmail, hashedPassword, safeAvatar, "user");

    sqlite.close();

    // ── Append to Excel sheet (Tracking Registered Users) ──
    appendUserToExcel({
      userId,
      name: safeName,
      email: safeEmail,
    }).catch((err) => console.error("[Excel] Failed to append user:", err));

    return NextResponse.json({
      success: true,
      message: "Account created successfully!",
    });
  } catch (error) {
    console.error("POST /api/register error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
