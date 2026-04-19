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

async function shouldHideTestDraftPublicContent(client: ReturnType<typeof getClient>) {
  try {
    const result = await client.execute({
      sql: "SELECT value FROM settings WHERE key = 'hide_test_draft_public_content'",
      args: [],
    });

    if (result.rows.length === 0) return true;
    const value = String(result.rows[0].value || "").trim().toLowerCase();
    return !(value === "false" || value === "0" || value === "no");
  } catch {
    return true;
  }
}

// GET /api/notes — List notes with filtering, search, sorting, and pagination
export async function GET(req: NextRequest) {
  try {
    runAutoApprovalSweepIfNeeded();

    const client = getClient();
    const hideTestDraft = await shouldHideTestDraftPublicContent(client);
    const { searchParams } = new URL(req.url);
    const session = await auth();
    const requesterId = session?.user?.id || null;
    const requesterRole = (session?.user as { role?: string } | undefined)?.role || "user";

    const category = searchParams.get("category");
    const search = searchParams.get("q");
    const tag = searchParams.get("tag");
    const author = searchParams.get("author");
    const sort = searchParams.get("sort") || "newest";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const featured = searchParams.get("featured");
    const requestedStatus = searchParams.get("status") || "approved";
    const canViewAllStatuses =
      requestedStatus === "all" &&
      (requesterRole === "admin" || (Boolean(author) && requesterId === author));
    const status = requestedStatus === "all" && !canViewAllStatuses ? "approved" : requestedStatus;
    const offset = (page - 1) * limit;

    let query = `
      SELECT n.*, c.name as category_name, c.slug as category_slug, COALESCE(u.name, n.author_credit, 'Anonymous') as author_name,
        GROUP_CONCAT(DISTINCT t.name) as tag_names
      FROM notes n
      LEFT JOIN categories c ON n.category_id = c.id
      LEFT JOIN users u ON n.author_id = u.id
      LEFT JOIN note_tags nt ON n.id = nt.note_id
      LEFT JOIN tags t ON nt.tag_id = t.id
      WHERE 1 = 1
    `;
    const params: (string | number)[] = [];

    if (author) {
      query += " AND n.author_id = ?";
      params.push(author);
    }

    if (status !== "all") {
      query += " AND n.status = ?";
      params.push(status);
    }

    if (hideTestDraft && status === "approved") {
      query += " AND LENGTH(TRIM(n.title)) >= 5";
    }

    if (category && category !== "All") {
      query += " AND c.slug = ?";
      params.push(category.toLowerCase().replace(/\s+/g, "-").replace("/", "-"));
    }

    if (tag) {
      query += " AND EXISTS (SELECT 1 FROM note_tags nt2 JOIN tags t2 ON nt2.tag_id = t2.id WHERE nt2.note_id = n.id AND t2.slug = ?)";
      params.push(tag);
    }

    if (search) {
      query += ` AND (
        n.title LIKE ? OR
        n.description LIKE ? OR
        c.name LIKE ? OR
        c.slug LIKE ? OR
        n.author_credit LIKE ? OR
        u.name LIKE ? OR
        n.file_name LIKE ? OR
        n.file_type LIKE ? OR
        n.source_url LIKE ? OR
        EXISTS (
          SELECT 1
          FROM note_tags nt2
          JOIN tags t2 ON nt2.tag_id = t2.id
          WHERE nt2.note_id = n.id
            AND (t2.name LIKE ? OR t2.slug LIKE ?)
        )
      )`;
      const like = `%${search}%`;
      params.push(
        like, like, like, like, like,
        like, like, like, like, like, like
      );
    }

    if (featured === "true") {
      query += " AND n.featured = 1";
    }

    query += " GROUP BY n.id";

    switch (sort) {
      case "popular":
        query += " ORDER BY n.view_count DESC";
        break;
      case "bookmarked":
        query += " ORDER BY n.bookmark_count DESC";
        break;
      case "oldest":
        query += " ORDER BY n.created_at ASC";
        break;
      default:
        query += " ORDER BY n.created_at DESC";
    }

    // Count query
    const countQuery = query
      .replace(
        `SELECT n.*, c.name as category_name, c.slug as category_slug, u.name as author_name,
        GROUP_CONCAT(DISTINCT t.name) as tag_names`,
        "SELECT COUNT(DISTINCT n.id) as total"
      )
      .replace(" GROUP BY n.id", "");

    const countResult = await client.execute({ sql: countQuery, args: params });
    const total = Number(countResult.rows[0]?.total ?? 0);

    query += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const result = await client.execute({ sql: query, args: params });

    const notes = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category_name,
      categorySlug: row.category_slug,
      author: row.author_name,
      authorCredit: row.author_credit,
      authorId: row.author_id,
      thumbnailUrl: row.thumbnail_url,
      fileUrl: row.file_url,
      fileName: row.file_name,
      fileType: row.file_type,
      fileSizeBytes: row.file_size_bytes,
      sourceUrl: row.source_url,
      licenseType: row.license_type,
      featured: row.featured === 1,
      viewCount: row.view_count,
      bookmarkCount: row.bookmark_count,
      tags: row.tag_names ? String(row.tag_names).split(",") : [],
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      notes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/notes error:", error);
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}
