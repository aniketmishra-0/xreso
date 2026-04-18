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

// POST /api/notes/[id]/report
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "You must be signed in to report a note." }, { status: 401 });
    }

    const params = await context.params;
    const noteId = params.id;

    const userEmail = session.user.email;
    if (!userEmail) {
      return NextResponse.json({ error: "User email required." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = body.reason || "Inappropriate content or broken link";

    const client = getClient();

    // Ensure table exists
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

    // Check if this user already reported this note
    const checkRes = await client.execute({
      sql: "SELECT id FROM reports WHERE note_id = ? AND user_email = ?",
      args: [noteId, userEmail],
    });

    if (checkRes.rows.length > 0) {
      return NextResponse.json({ error: "You have already reported this note." }, { status: 400 });
    }

    // Insert the report
    const reportId = crypto.randomUUID();
    await client.execute({
      sql: "INSERT INTO reports (id, note_id, user_email, reason) VALUES (?, ?, ?, ?)",
      args: [reportId, noteId, userEmail, reason],
    });

    // Count how many unique users reported this note
    const countRes = await client.execute({
      sql: "SELECT COUNT(DISTINCT user_email) as count FROM reports WHERE note_id = ?",
      args: [noteId],
    });
    
    const reportCount = Number(countRes.rows[0]?.count || 0);

    // If 3 or more users have reported, auto-reject the note
    if (reportCount >= 3) {
      await client.execute({
        sql: "UPDATE notes SET status = 'rejected' WHERE id = ?",
        args: [noteId],
      });
      return NextResponse.json({ success: true, message: "Report submitted. The resource has been automatically removed pending admin review." });
    }

    return NextResponse.json({ success: true, message: "Report submitted. An admin will review it." });

  } catch (error) {
    console.error("Report error:", error);
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
}
