import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@libsql/client/web";

function getClient() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("TURSO_DATABASE_URL is not configured");
  }

  return createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const role = (session.user as { role?: string }).role || "user";
    if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const client = getClient();
    
    // Ensure table exists just in case
    await client.execute(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        note_id TEXT,
        user_email TEXT,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Fetch reports grouped by note_id with note details
    // We want to see how many reports a note has, and basic note info
    const result = await client.execute(`
      SELECT 
        r.note_id,
        COUNT(r.id) as report_count,
        MAX(r.created_at) as last_reported_at,
        n.title,
        n.status as note_status,
        n.author_name
      FROM reports r
      LEFT JOIN notes n ON r.note_id = n.id
      WHERE r.status = 'pending'
      GROUP BY r.note_id
      ORDER BY report_count DESC, last_reported_at DESC
    `);

    return NextResponse.json({ reports: result.rows });
  } catch (error) {
    console.error("GET /api/admin/reports error:", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const role = (session.user as { role?: string }).role || "user";
    if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { noteId } = body;
    if (!noteId) return NextResponse.json({ error: "Note ID required" }, { status: 400 });

    const client = getClient();
    // Dismiss reports for this note (mark as resolved)
    await client.execute({
      sql: "UPDATE reports SET status = 'resolved' WHERE note_id = ?",
      args: [noteId]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/reports error:", error);
    return NextResponse.json({ error: "Failed to dismiss report" }, { status: 500 });
  }
}
