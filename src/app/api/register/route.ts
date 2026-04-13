import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import { hashSync } from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");

// POST /api/register — Create new user
export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const sqlite = new Database(DB_PATH);

    const existing = sqlite
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email) as { id: string } | undefined;

    if (existing) {
      sqlite.close();
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const userId = uuidv4();
    const hashedPassword = hashSync(password, 10);

    sqlite
      .prepare(
        "INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)"
      )
      .run(userId, name, email, hashedPassword, "user");

    sqlite.close();

    return NextResponse.json({
      success: true,
      message: "Account created successfully!",
    });
  } catch (error) {
    console.error("POST /api/register error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
