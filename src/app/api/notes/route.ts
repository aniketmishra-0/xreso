import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { auth } from "@/lib/auth";

const DB_PATH = path.join(process.cwd(), "xreso.db");

// GET /api/notes — List notes with filtering, search, sorting, and pagination
export async function GET(req: NextRequest) {
  try {
    const sqlite = new Database(DB_PATH, { readonly: true });
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
      SELECT n.*, c.name as category_name, c.slug as category_slug, u.name as author_name,
        u.github_url as author_github, u.linkedin_url as author_linkedin, u.twitter_url as author_twitter, u.website_url as author_website,
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
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like
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

    const countQuery = query
      .replace(
        `SELECT n.*, c.name as category_name, c.slug as category_slug, u.name as author_name,
        u.github_url as author_github, u.linkedin_url as author_linkedin, u.twitter_url as author_twitter, u.website_url as author_website,
        GROUP_CONCAT(DISTINCT t.name) as tag_names`,
        "SELECT COUNT(DISTINCT n.id) as total"
      )
      .replace(" GROUP BY n.id", "");
    const total =
      (sqlite.prepare(countQuery).get(...params) as { total: number } | undefined)
        ?.total || 0;

    query += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const rows = sqlite.prepare(query).all(...params) as Record<string, unknown>[];

    const notes = rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category_name,
      categorySlug: row.category_slug,
      author: row.author_name,
      authorCredit: row.author_credit,
      authorId: row.author_id,
      authorGithub: row.author_github,
      authorLinkedin: row.author_linkedin,
      authorTwitter: row.author_twitter,
      authorWebsite: row.author_website,
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
      tags: row.tag_names ? (row.tag_names as string).split(",") : [],
      createdAt: row.created_at,
    }));

    sqlite.close();

    return NextResponse.json({
      notes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/notes error:", error);
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}
