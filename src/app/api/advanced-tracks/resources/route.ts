import { NextRequest, NextResponse } from "next/server";
import { createClient, Client } from "@libsql/client/web";
import { auth } from "@/lib/auth";
import { runAutoApprovalSweepIfNeeded } from "@/lib/moderation";

type SortValue = "newest" | "popular" | "featured";

function getClient(): Client {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("TURSO_DATABASE_URL is not configured");
  }

  return createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

async function shouldHideTestDraftPublicContent(client: Client) {
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

function toRecord(row: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    output[key] = typeof value === "bigint" ? Number(value) : value;
  }
  return output;
}

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export async function GET(req: NextRequest) {
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

    const client = getClient();
    const hideTestDraft = await shouldHideTestDraftPublicContent(client);

    const { searchParams } = new URL(req.url);
    const track = searchParams.get("track");
    const topic = searchParams.get("topic");
    const search = searchParams.get("q")?.trim();
    const sort = (searchParams.get("sort") || "newest") as SortValue;
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "20");
    const safePage = Math.max(page, 1);
    const safeLimit = Math.max(limit, 1);
    const offset = (safePage - 1) * safeLimit;

    let where = "WHERE atr.status = 'approved' AND at.status = 'active'";
    if (hideTestDraft) {
      where += " AND LENGTH(TRIM(atr.title)) >= 5";
    }
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

    const totalResult = await client.execute({
      sql: `SELECT COUNT(*) as total
      FROM advanced_track_resources atr
      JOIN advanced_tracks at ON atr.track_id = at.id
      LEFT JOIN advanced_track_topics att ON atr.topic_id = att.id
      ${where}`,
      args: params,
    });

    const total = toNumber(totalResult.rows[0]?.total, 0);

    const rowsResult = await client.execute({
      sql: `SELECT
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
        NULL as author_github,
        NULL as author_linkedin,
        NULL as author_twitter,
        NULL as author_website,
        GROUP_CONCAT(DISTINCT atrt.tag) as tag_names
      FROM advanced_track_resources atr
      JOIN advanced_tracks at ON atr.track_id = at.id
      LEFT JOIN advanced_track_topics att ON atr.topic_id = att.id
      LEFT JOIN users u ON atr.author_id = u.id
      LEFT JOIN advanced_track_resource_tags atrt ON atrt.resource_id = atr.id
      ${where}
      GROUP BY atr.id
      ORDER BY ${buildOrderBy(sort)}
      LIMIT ? OFFSET ?`,
      args: [...params, safeLimit, offset],
    });

    const resources = rowsResult.rows.map((row) => {
      const normalized = toRecord(row as Record<string, unknown>);
      const rawContentUrl =
        typeof normalized.content_url === "string" ? normalized.content_url : "";
      const resolvedContentUrl = rawContentUrl.startsWith("onedrive://")
        ? `/api/advanced-tracks/resource/${normalized.id}`
        : rawContentUrl;

      return {
        id: normalized.id,
        title: normalized.title,
        summary: normalized.summary,
        resourceType: normalized.resource_type,
        contentUrl: resolvedContentUrl,
        accessLocked: false,
        thumbnailUrl: normalized.thumbnail_url,
        premiumOnly: false,
        featured: Boolean(normalized.featured),
        status: normalized.status,
        viewCount: toNumber(normalized.view_count),
        saveCount: toNumber(normalized.save_count),
        createdAt: normalized.created_at,
        trackSlug: normalized.track_slug,
        trackName: normalized.track_name,
        topicSlug: normalized.topic_slug,
        topicName: normalized.topic_name,
        authorId: normalized.author_id,
        authorName: normalized.author_name,
        authorGithub: normalized.author_github,
        authorLinkedin: normalized.author_linkedin,
        authorTwitter: normalized.author_twitter,
        authorWebsite: normalized.author_website,
        tags:
          typeof normalized.tag_names === "string" && normalized.tag_names
            ? normalized.tag_names.split(",")
            : [],
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
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    });
  } catch (error) {
    console.error("GET /api/advanced-tracks/resources error:", error);
    return NextResponse.json(
      { error: "Failed to fetch advanced resources" },
      { status: 500 }
    );
  }
}
