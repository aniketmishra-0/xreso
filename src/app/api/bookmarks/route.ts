import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@libsql/client/web";

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

    const client = getClient();

    const existing = await client.execute({
      sql: "SELECT id FROM bookmarks WHERE user_id = ? AND note_id = ?",
      args: [session.user.id, noteId],
    });

    if (existing.rows.length > 0) {
      await client.execute({
        sql: "DELETE FROM bookmarks WHERE user_id = ? AND note_id = ?",
        args: [session.user.id, noteId],
      });
      await client.execute({
        sql: "UPDATE notes SET bookmark_count = MAX(0, bookmark_count - 1) WHERE id = ?",
        args: [noteId],
      });
      return NextResponse.json({ bookmarked: false });
    } else {
      await client.execute({
        sql: "INSERT INTO bookmarks (user_id, note_id) VALUES (?, ?)",
        args: [session.user.id, noteId],
      });
      await client.execute({
        sql: "UPDATE notes SET bookmark_count = bookmark_count + 1 WHERE id = ?",
        args: [noteId],
      });
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

    const client = getClient();

    const result = await client.execute({
      sql: `SELECT n.id, n.title, n.thumbnail_url, n.view_count, n.bookmark_count,
          c.name as category_name, u.name as author_name, b.created_at as bookmarked_at
        FROM bookmarks b
        JOIN notes n ON b.note_id = n.id
        LEFT JOIN categories c ON n.category_id = c.id
        LEFT JOIN users u ON n.author_id = u.id
        WHERE b.user_id = ?
        ORDER BY b.created_at DESC`,
      args: [session.user.id],
    });

    return NextResponse.json({ bookmarks: result.rows });
  } catch (error) {
    console.error("GET /api/bookmarks error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
