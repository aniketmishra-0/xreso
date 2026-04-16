import { NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";

function getClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!
  });
}

export async function GET() {
  try {
    const client = getClient();

    const trackRowsRes = await client.execute(
        `SELECT
          at.id,
          at.slug,
          at.name,
          at.description,
          at.premium,
          at.status,
          at.sort_order,
          COUNT(CASE WHEN atr.status = 'approved' THEN 1 END) as approved_count
         FROM advanced_tracks at
         LEFT JOIN advanced_track_resources atr ON atr.track_id = at.id
         WHERE at.status = 'active'
         GROUP BY at.id
         ORDER BY at.sort_order ASC, at.name ASC`
    );

    const topicRowsRes = await client.execute(
        `SELECT id, track_id, slug, name, description, level, sort_order
         FROM advanced_track_topics
         ORDER BY sort_order ASC, name ASC`
    );

    const trackRows = trackRowsRes.rows;
    const topicRows = topicRowsRes.rows;

    const tracks = trackRows.map((track) => ({
      id: track.id as number,
      slug: track.slug as string,
      name: track.name as string,
      description: track.description as string,
      premium: Boolean(track.premium),
      approvedCount: (track.approved_count as number) || 0,
      topics: topicRows
        .filter((topic) => topic.track_id === track.id)
        .map((topic) => ({
          id: topic.id as number,
          slug: topic.slug as string,
          name: topic.name as string,
          description: topic.description as string,
          level: topic.level as string,
        })),
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
