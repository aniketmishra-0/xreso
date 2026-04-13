import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");

// POST /api/bookmarks — Toggle bookmark
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { noteId } = await req.json();
    if (!noteId) {
      return NextResponse.json({ error: "Missing noteId" }, { status: 400 });
    }

    const sqlite = new Database(DB_PATH);

    const existing = sqlite
      .prepare("SELECT id FROM bookmarks WHERE user_id = ? AND note_id = ?")
      .get(session.user.id, noteId) as { id: number } | undefined;

    if (existing) {
      sqlite.prepare("DELETE FROM bookmarks WHERE user_id = ? AND note_id = ?").run(session.user.id, noteId);
      sqlite.prepare("UPDATE notes SET bookmark_count = MAX(0, bookmark_count - 1) WHERE id = ?").run(noteId);
      sqlite.close();
      return NextResponse.json({ bookmarked: false });
    } else {
      sqlite.prepare("INSERT INTO bookmarks (user_id, note_id) VALUES (?, ?)").run(session.user.id, noteId);
      sqlite.prepare("UPDATE notes SET bookmark_count = bookmark_count + 1 WHERE id = ?").run(noteId);
      sqlite.close();
      return NextResponse.json({ bookmarked: true });
    }
  } catch (error) {
    console.error("POST /api/bookmarks error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// GET /api/bookmarks — Get user bookmarks
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sqlite = new Database(DB_PATH, { readonly: true });

    const rows = sqlite
      .prepare(
        `SELECT n.id, n.title, n.thumbnail_url, n.view_count, n.bookmark_count,
          c.name as category_name, u.name as author_name, b.created_at as bookmarked_at
        FROM bookmarks b
        JOIN notes n ON b.note_id = n.id
        LEFT JOIN categories c ON n.category_id = c.id
        LEFT JOIN users u ON n.author_id = u.id
        WHERE b.user_id = ?
        ORDER BY b.created_at DESC`
      )
      .all(session.user.id) as Record<string, unknown>[];

    sqlite.close();
    return NextResponse.json({ bookmarks: rows });
  } catch (error) {
    console.error("GET /api/bookmarks error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
