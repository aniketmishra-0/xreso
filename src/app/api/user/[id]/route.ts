import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");

/* GET /api/user/[id] — public profile (no auth required) */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = new Database(DB_PATH);

    const user = db
      .prepare("SELECT id, name, avatar, bio, github_url, linkedin_url, twitter_url, website_url, created_at FROM users WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;

    if (!user) {
      db.close();
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const notes = db
      .prepare(`
        SELECT n.id, n.title, n.thumbnail_url, n.view_count, n.bookmark_count, n.created_at,
               c.name as category_name
        FROM notes n
        JOIN categories c ON n.category_id = c.id
        WHERE n.author_id = ? AND n.status = 'approved'
        ORDER BY n.created_at DESC
        LIMIT 20
      `)
      .all(id) as Record<string, unknown>[];

    db.close();
    return NextResponse.json({ user, notes });
  } catch (err) {
    console.error("GET /api/user/[id] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
