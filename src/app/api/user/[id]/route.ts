import { NextRequest, NextResponse } from "next/server";
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

/* GET /api/user/[id] — public profile (no auth required) */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const client = getClient();

    const userResult = await client.execute({
      sql: "SELECT id, name, avatar, bio, created_at FROM users WHERE id = ?",
      args: [id],
    });

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const notesResult = await client.execute({
      sql: `SELECT n.id, n.title, n.thumbnail_url, n.view_count, n.bookmark_count, n.created_at,
               c.name as category_name
        FROM notes n
        JOIN categories c ON n.category_id = c.id
        WHERE n.author_id = ? AND n.status = 'approved'
        ORDER BY n.created_at DESC
        LIMIT 20`,
      args: [id],
    });

    return NextResponse.json({ user: userResult.rows[0], notes: notesResult.rows });
  } catch (err) {
    console.error("GET /api/user/[id] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
