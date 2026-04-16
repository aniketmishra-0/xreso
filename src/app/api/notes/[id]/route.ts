import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";
import { auth } from "@/lib/auth";
import { runAutoApprovalSweepIfNeeded } from "@/lib/moderation";

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

// GET /api/notes/[id] — Get single note
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    runAutoApprovalSweepIfNeeded();

    const session = await auth();
    const sessionUser = session?.user as { id?: string; role?: string } | undefined;
    const sessionRole = sessionUser?.role || "user";
    const isPrivileged = sessionRole === "admin" || sessionRole === "moderator";
    const client = getClient();

    const result = await client.execute({
      sql: `SELECT n.*, c.name as category_name, c.slug as category_slug,
             u.name as author_name, u.avatar as author_avatar, u.bio as author_bio
      FROM notes n
      LEFT JOIN categories c ON n.category_id = c.id
      LEFT JOIN users u ON n.author_id = u.id
      WHERE n.id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const row = result.rows[0];

    const noteStatus = String(row.status || "pending");
    const isAuthor = Boolean(sessionUser?.id && row.author_id === sessionUser.id);
    if (noteStatus !== "approved" && !isPrivileged && !isAuthor) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Increment view count
    await client.execute({
      sql: "UPDATE notes SET view_count = view_count + 1 WHERE id = ?",
      args: [id],
    });
    await client.execute({
      sql: "INSERT INTO views (note_id) VALUES (?)",
      args: [id],
    });

    const tagResult = await client.execute({
      sql: `SELECT t.name FROM note_tags nt JOIN tags t ON nt.tag_id = t.id WHERE nt.note_id = ?`,
      args: [id],
    });

    const note = {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category_name,
      categorySlug: row.category_slug,
      author: row.author_name,
      authorAvatar: row.author_avatar,
      authorBio: row.author_bio,
      authorId: row.author_id,
      authorCredit: row.author_credit,
      thumbnailUrl: row.thumbnail_url,
      fileUrl: row.file_url,
      fileName: row.file_name,
      fileType: row.file_type,
      fileSizeBytes: row.file_size_bytes,
      sourceUrl: row.source_url,
      licenseType: row.license_type,
      status: row.status,
      featured: row.featured === 1,
      viewCount: (Number(row.view_count) || 0) + 1,
      bookmarkCount: row.bookmark_count,
      tags: tagResult.rows.map((t) => String(t.name)),
      createdAt: row.created_at,
    };

    return NextResponse.json({ note });
  } catch (error) {
    console.error("GET /api/notes/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
