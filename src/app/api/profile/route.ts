import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");

/* GET /api/profile — return current user's full profile */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const db = new Database(DB_PATH);
    const user = db
      .prepare("SELECT id, name, email, avatar, bio, github_url, linkedin_url, twitter_url, website_url, role, created_at FROM users WHERE id = ?")
      .get(session.user.id) as Record<string, unknown> | undefined;
    db.close();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ user });
  } catch (err) {
    console.error("GET /api/profile error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* PATCH /api/profile — update bio + social links */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { name, bio, githubUrl, linkedinUrl, twitterUrl, websiteUrl } = body;

    // Basic URL validation helper
    const sanitizeUrl = (url: string | undefined) => {
      if (!url || url.trim() === "") return null;
      const u = url.trim();
      if (!u.startsWith("http://") && !u.startsWith("https://")) return `https://${u}`;
      return u;
    };

    const db = new Database(DB_PATH);
    db.prepare(
      `UPDATE users SET
         name = COALESCE(?, name),
         bio = ?,
         github_url = ?,
         linkedin_url = ?,
         twitter_url = ?,
         website_url = ?,
         updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      name?.trim() || null,
      bio?.trim() || null,
      sanitizeUrl(githubUrl),
      sanitizeUrl(linkedinUrl),
      sanitizeUrl(twitterUrl),
      sanitizeUrl(websiteUrl),
      session.user.id
    );

    const updated = db
      .prepare("SELECT id, name, email, avatar, bio, github_url, linkedin_url, twitter_url, website_url, role FROM users WHERE id = ?")
      .get(session.user.id);
    db.close();

    return NextResponse.json({ success: true, user: updated });
  } catch (err) {
    console.error("PATCH /api/profile error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
