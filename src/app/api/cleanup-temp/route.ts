import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";

export const dynamic = "force-dynamic";

// One-time cleanup route — DELETE THIS FILE after running once
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("key");
  if (secret !== "xreso-cleanup-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const JUNK_IDS = [
    "a09274d7-1566-4f53-bae3-7d28b148c807", // "Live"
    "b837c52e-bd43-4db1-8e5f-2d350cf09039", // "SQL Resume"
    "5d2c6a52-6c74-484f-8337-346d211fc219", // "SQL 1 2 3"
    "53c068af-227a-4383-8b05-6419f226572f", // "Resume"
    "377b87c0-2092-47d9-b788-c5f52109b7b9", // "resume 2"
    "5c2b8ddb-dd4b-4a1f-b40c-1285969afdc3", // "Resume"
    "c4dede49-8985-4b61-ba60-d1929cf5d63e", // "SQL 2"
    "d6bf6930-c8eb-40bc-9eab-7007350d3f6d", // "SQL"
    "0129411d-f94a-4cce-b560-f2d6b0fc8ed3", // "Python List Comp" (seed)
    "2f16a07b-81a0-4225-81f3-f566e0070631", // "React Hooks" (seed)
    "5ffb8d57-ad55-4c9b-92f4-bf23bdcc4988", // "Java OOP" (seed)
    "78cef6e7-42ce-4ce5-b046-8538ec492e7b", // "JS Async/Await" (seed)
    "f908e69c-3d98-4b58-88e6-6856f50da54f", // "SQL Joins" (seed)
  ];

  const deleted: string[] = [];

  for (const noteId of JUNK_IDS) {
    const noteRes = await client.execute({
      sql: "SELECT title FROM notes WHERE id = ?",
      args: [noteId],
    });
    const title = noteRes.rows[0]?.title || "Not found";

    await client.execute({ sql: "DELETE FROM note_tags WHERE note_id = ?", args: [noteId] });
    await client.execute({ sql: "DELETE FROM bookmarks WHERE note_id = ?", args: [noteId] });
    await client.execute({ sql: "DELETE FROM views WHERE note_id = ?", args: [noteId] });
    await client.execute({ sql: "DELETE FROM reports WHERE note_id = ?", args: [noteId] });
    const result = await client.execute({ sql: "DELETE FROM notes WHERE id = ?", args: [noteId] });

    if (Number(result.rowsAffected) > 0) {
      deleted.push(`${title} (${noteId})`);
    }
  }

  // Clean orphan tags
  await client.execute("DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags)");

  // Update category counts
  await client.execute(
    `UPDATE categories SET note_count = (
      SELECT COUNT(*) FROM notes WHERE notes.category_id = categories.id AND notes.status = 'approved'
    )`
  );

  // Dedup topics
  const dupTopics = await client.execute(
    `SELECT track_id, slug, MIN(id) as keep_id, COUNT(*) as cnt
     FROM advanced_track_topics
     GROUP BY track_id, slug
     HAVING cnt > 1`
  );

  const dedupedTopics: string[] = [];
  for (const row of dupTopics.rows) {
    await client.execute({
      sql: "DELETE FROM advanced_track_topics WHERE track_id = ? AND slug = ? AND id != ?",
      args: [row.track_id, row.slug, row.keep_id],
    });
    dedupedTopics.push(`${row.slug} in track ${row.track_id}`);
  }

  const remaining = await client.execute("SELECT COUNT(*) as count FROM notes");

  return NextResponse.json({
    success: true,
    deleted,
    dedupedTopics,
    notesRemaining: Number(remaining.rows[0]?.count),
  });
}
