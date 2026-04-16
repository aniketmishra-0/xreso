import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { auth } from "@/lib/auth";
import { runAutoApprovalSweepIfNeeded } from "@/lib/moderation";

const DB_PATH = path.join(process.cwd(), "xreso.db");

type SortValue = "newest" | "popular" | "featured";

function buildOrderBy(sort: SortValue) {
  switch (sort) {
    case "popular":
      return "atr.view_count DESC, atr.created_at DESC";
    case "featured":
      return "atr.featured DESC, atr.created_at DESC";
    default:
      return "atr.created_at DESC";
  }
}

export async function GET(req: NextRequest) {
  let sqlite: Database.Database | null = null;

  try {
    runAutoApprovalSweepIfNeeded();

    const session = await auth();
    const sessionUser = session?.user as
      | {
          id?: string;
          role?: string;
        }
      | undefined;

    const viewerRole =
      sessionUser?.role === "admin" || sessionUser?.role === "moderator"
        ? sessionUser.role
        : sessionUser?.role === "user"
          ? "user"
          : "guest";

    sqlite = new Database(DB_PATH);
    sqlite.pragma("foreign_keys = ON");

    const { searchParams } = new URL(req.url);
    const track = searchParams.get("track");
    const topic = searchParams.get("topic");
    const search = searchParams.get("q")?.trim();
    const sort = (searchParams.get("sort") || "newest") as SortValue;
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "20");
    const offset = (Math.max(page, 1) - 1) * Math.max(limit, 1);

    let where = "WHERE atr.status = 'approved' AND at.status = 'active'";
    const params: Array<string | number> = [];

    if (track) {
      where += " AND at.slug = ?";
      params.push(track);
    }

    if (topic) {
      where += " AND att.slug = ?";
      params.push(topic);
    }

    if (search) {
      where += ` AND (
        atr.title LIKE ? OR
        atr.summary LIKE ? OR
        at.name LIKE ? OR
        at.slug LIKE ? OR
        att.name LIKE ? OR
        EXISTS (
          SELECT 1
          FROM advanced_track_resource_tags atrt
          WHERE atrt.resource_id = atr.id
            AND atrt.tag LIKE ?
        )
      )`;
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM advanced_track_resources atr
      JOIN advanced_tracks at ON atr.track_id = at.id
      LEFT JOIN advanced_track_topics att ON atr.topic_id = att.id
      ${where}
    `;

    const total =
      (sqlite.prepare(countQuery).get(...params) as { total: number } | undefined)
        ?.total || 0;

    const query = `
      SELECT
        atr.id,
        atr.title,
        atr.summary,
        atr.resource_type,
        atr.content_url,
        atr.thumbnail_url,
        atr.premium_only,
        atr.featured,
        atr.status,
        atr.view_count,
        atr.save_count,
        atr.created_at,
        at.slug as track_slug,
        at.name as track_name,
        att.slug as topic_slug,
        att.name as topic_name,
        u.id as author_id,
        u.name as author_name,
        u.github_url as author_github,
        u.linkedin_url as author_linkedin,
        u.twitter_url as author_twitter,
        u.website_url as author_website,
        GROUP_CONCAT(DISTINCT atrt.tag) as tag_names
      FROM advanced_track_resources atr
      JOIN advanced_tracks at ON atr.track_id = at.id
      LEFT JOIN advanced_track_topics att ON atr.topic_id = att.id
      LEFT JOIN users u ON atr.author_id = u.id
      LEFT JOIN advanced_track_resource_tags atrt ON atrt.resource_id = atr.id
      ${where}
      GROUP BY atr.id
      ORDER BY ${buildOrderBy(sort)}
      LIMIT ? OFFSET ?
    `;

    const rows = sqlite.prepare(query).all(...params, limit, offset) as Array<
      Record<string, unknown>
    >;

    const resources = rows.map((row) => {
      const rawContentUrl =
        typeof row.content_url === "string" ? row.content_url : "";
      const resolvedContentUrl = rawContentUrl.startsWith("onedrive://")
        ? `/api/advanced-tracks/resource/${row.id}`
        : rawContentUrl;

      return {
        id: row.id,
        title: row.title,
        summary: row.summary,
        resourceType: row.resource_type,
        contentUrl: resolvedContentUrl,
        accessLocked: false,
        thumbnailUrl: row.thumbnail_url,
        premiumOnly: false,
        featured: Boolean(row.featured),
        status: row.status,
        viewCount: row.view_count,
        saveCount: row.save_count,
        createdAt: row.created_at,
        trackSlug: row.track_slug,
        trackName: row.track_name,
        topicSlug: row.topic_slug,
        topicName: row.topic_name,
        authorId: row.author_id,
        authorName: row.author_name,
        authorGithub: row.author_github,
        authorLinkedin: row.author_linkedin,
        authorTwitter: row.author_twitter,
        authorWebsite: row.author_website,
        tags: row.tag_names ? String(row.tag_names).split(",") : [],
      };
    });

    return NextResponse.json({
      resources,
      viewer: {
        role: viewerRole,
        isAuthenticated: Boolean(sessionUser),
        hasPremiumAccess: true,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/advanced-tracks/resources error:", error);
    return NextResponse.json(
      { error: "Failed to fetch advanced resources" },
      { status: 500 }
    );
  } finally {
    if (sqlite) sqlite.close();
  }
}
