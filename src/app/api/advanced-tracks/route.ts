import { NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";

function getClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!
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

export async function GET() {
  try {
    const client = getClient();
    const hideTestDraft = await shouldHideTestDraftPublicContent(client);

    const trackRowsRes = await client.execute(
        `SELECT
          at.id,
          at.slug,
          at.name,
          at.description,
          at.premium,
          at.status,
          at.sort_order,
          COUNT(CASE
            WHEN atr.status = 'approved'
              ${hideTestDraft ? "AND LENGTH(TRIM(atr.title)) >= 5" : ""}
            THEN 1
          END) as approved_count
         FROM advanced_tracks at
         LEFT JOIN advanced_track_resources atr ON atr.track_id = at.id
         WHERE at.status = 'active'
         GROUP BY at.id
         ORDER BY at.sort_order ASC, at.name ASC`
    );

    const trackRows = trackRowsRes.rows.map((track) => ({
      id: Number(track.id),
      slug: String(track.slug),
      name: String(track.name),
      description: String(track.description || ""),
      approvedCount: Number(track.approved_count || 0),
    }));

    const topicRowsRes = await client.execute(
        `SELECT id, track_id, slug, name, description, level, sort_order
         FROM advanced_track_topics
         ORDER BY sort_order ASC, name ASC`
    );

    const topicRows = topicRowsRes.rows;

    const tracks = trackRows.map((track) => ({
      id: track.id,
      slug: track.slug,
      name: track.name,
      description: track.description,
      premium: false,
      approvedCount: track.approvedCount,
      topics: (() => {
        // Deduplicate by composite key: track_id + slug
        const topicMap = new Map<string, {
          id: number;
          slug: string;
          name: string;
          description: string;
          level: string;
        }>();

        for (const topic of topicRows) {
          if (Number(topic.track_id) !== track.id) continue;

          const topicName = String(topic.name || "").trim();
          if (!topicName) continue;

          const topicSlug = String(topic.slug || "");
          const dedupeKey = `${topicSlug}::${topicName.toLowerCase()}`;
          if (topicMap.has(dedupeKey)) continue;

          topicMap.set(dedupeKey, {
            id: Number(topic.id),
            slug: topicSlug,
            name: topicName,
            description: String(topic.description || ""),
            level: String(topic.level || "Beginner"),
          });
        }

        return Array.from(topicMap.values());
      })(),
    }));

    return NextResponse.json({ tracks });
  } catch (error) {
    console.error("GET /api/advanced-tracks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch advanced tracks" },
      { status: 500 }
    );
  }
}
