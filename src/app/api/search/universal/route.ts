import { NextRequest, NextResponse } from "next/server";
import { createClient, type Client } from "@libsql/client/web";

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

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = (searchParams.get("q") || "").trim();
    const limit = Math.min(12, Math.max(1, Number(searchParams.get("limit") || "8")));

    if (!query) {
      return NextResponse.json({
        query,
        notes: [],
        videos: [],
        categories: [],
        tracks: [],
        resources: [],
      });
    }

    const like = `%${query}%`;
    const client = getClient();
    const hideTestDraft = await shouldHideTestDraftPublicContent(client);

    const [notesResult, videosResult, categoriesResult, tracksResult, resourcesResult] =
      await Promise.all([
        client.execute({
          sql: `SELECT n.id, n.title, n.description, n.created_at, c.name as category_name, c.slug as category_slug
                FROM notes n
                LEFT JOIN categories c ON n.category_id = c.id
                LEFT JOIN users u ON n.author_id = u.id
                WHERE n.status = 'approved'
                  ${hideTestDraft ? "AND LENGTH(TRIM(n.title)) >= 5" : ""}
                  AND (
                    n.title LIKE ? OR
                    n.description LIKE ? OR
                    c.name LIKE ? OR
                    c.slug LIKE ? OR
                    n.author_credit LIKE ? OR
                    u.name LIKE ? OR
                    n.file_name LIKE ? OR
                    n.file_type LIKE ?
                  )
                ORDER BY n.created_at DESC
                LIMIT ?`,
          args: [like, like, like, like, like, like, like, like, limit],
        }),
        client.execute({
          sql: `SELECT v.id, v.title, v.description, v.created_at, c.name as category_name, c.slug as category_slug
                FROM videos v
                LEFT JOIN categories c ON v.category_id = c.id
                WHERE v.status = 'approved'
                  ${hideTestDraft ? "AND LENGTH(TRIM(v.title)) >= 5" : ""}
                  AND (
                    v.title LIKE ? OR
                    v.description LIKE ? OR
                    c.name LIKE ? OR
                    c.slug LIKE ?
                  )
                ORDER BY v.created_at DESC
                LIMIT ?`,
          args: [like, like, like, like, limit],
        }),
        client.execute({
          sql: `SELECT c.id, c.name, c.slug, c.description,
                    (SELECT COUNT(*)
                     FROM notes n
                     WHERE n.category_id = c.id
                       AND n.status = 'approved'
                       ${hideTestDraft ? "AND LENGTH(TRIM(n.title)) >= 5" : ""}) as live_count
                FROM categories c
                WHERE c.name LIKE ? OR c.slug LIKE ? OR c.description LIKE ?
                ORDER BY live_count DESC, c.name ASC
                LIMIT ?`,
          args: [like, like, like, limit],
        }),
        client.execute({
          sql: `SELECT at.id, at.slug, at.name, at.description,
                    COUNT(CASE
                      WHEN atr.status = 'approved'
                        ${hideTestDraft ? "AND LENGTH(TRIM(atr.title)) >= 5" : ""}
                      THEN 1
                    END) as approved_count
                FROM advanced_tracks at
                LEFT JOIN advanced_track_resources atr ON atr.track_id = at.id
                WHERE at.status = 'active'
                  AND (at.name LIKE ? OR at.slug LIKE ? OR at.description LIKE ?)
                GROUP BY at.id
                ORDER BY approved_count DESC, at.name ASC
                LIMIT ?`,
          args: [like, like, like, limit],
        }),
        client.execute({
          sql: `SELECT atr.id, atr.title, atr.summary, atr.created_at,
                    at.slug as track_slug, at.name as track_name,
                    att.slug as topic_slug, att.name as topic_name
                FROM advanced_track_resources atr
                JOIN advanced_tracks at ON atr.track_id = at.id
                LEFT JOIN advanced_track_topics att ON atr.topic_id = att.id
                WHERE atr.status = 'approved'
                  AND at.status = 'active'
                  ${hideTestDraft ? "AND LENGTH(TRIM(atr.title)) >= 5" : ""}
                  AND (
                    atr.title LIKE ? OR
                    atr.summary LIKE ? OR
                    at.name LIKE ? OR
                    at.slug LIKE ? OR
                    IFNULL(att.name, '') LIKE ?
                  )
                ORDER BY atr.created_at DESC
                LIMIT ?`,
          args: [like, like, like, like, like, limit],
        }),
      ]);

    const notes = notesResult.rows.map((row) => ({
      id: String(row.id || ""),
      title: String(row.title || "Untitled note"),
      description: String(row.description || ""),
      category: String(row.category_name || "General"),
      categorySlug: String(row.category_slug || ""),
      createdAt: String(row.created_at || ""),
    }));

    const videos = videosResult.rows.map((row) => ({
      id: String(row.id || ""),
      title: String(row.title || "Untitled video"),
      description: String(row.description || ""),
      category: String(row.category_name || "General"),
      categorySlug: String(row.category_slug || ""),
      createdAt: String(row.created_at || ""),
    }));

    const categories = categoriesResult.rows.map((row) => ({
      id: toNumber(row.id),
      name: String(row.name || ""),
      slug: String(row.slug || ""),
      description: String(row.description || ""),
      noteCount: toNumber(row.live_count),
    }));

    const tracks = tracksResult.rows.map((row) => ({
      id: toNumber(row.id),
      slug: String(row.slug || ""),
      name: String(row.name || ""),
      description: String(row.description || ""),
      approvedCount: toNumber(row.approved_count),
    }));

    const resources = resourcesResult.rows.map((row) => ({
      id: String(row.id || ""),
      title: String(row.title || "Untitled resource"),
      summary: String(row.summary || ""),
      trackSlug: String(row.track_slug || ""),
      trackName: String(row.track_name || ""),
      topicSlug: String(row.topic_slug || ""),
      topicName: String(row.topic_name || ""),
      createdAt: String(row.created_at || ""),
    }));

    return NextResponse.json({
      query,
      notes,
      videos,
      categories,
      tracks,
      resources,
    });
  } catch (error) {
    console.error("GET /api/search/universal error:", error);
    return NextResponse.json({ error: "Failed to run universal search" }, { status: 500 });
  }
}
