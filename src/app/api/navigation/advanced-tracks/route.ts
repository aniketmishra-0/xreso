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

    const result = await client.execute(
        `SELECT
          at.slug,
          at.name,
          at.description,
          COUNT(CASE WHEN atr.status = 'approved' THEN 1 END) as approved_count
         FROM advanced_tracks at
         LEFT JOIN advanced_track_resources atr ON atr.track_id = at.id
         WHERE at.status = 'active'
         GROUP BY at.id
         ORDER BY at.sort_order ASC, at.name ASC`
    );

    const rows = result.rows;

    const items = [
      {
        id: "advanced-library",
        label: "Open Tracks Library",
        description: "Open advanced learning paths",
        href: "/tracks/library",
        count: rows.reduce((sum, row) => sum + ((row.approved_count as number) || 0), 0),
      },
      ...rows.map((row) => ({
        id: `advanced-${row.slug}`,
        label: `${row.name} Notes`,
        description: row.description as string,
        href: `/tracks/notes?track=${row.slug}`,
        count: (row.approved_count as number) || 0,
      })),
    ];

    return NextResponse.json({
      section: "advanced-tracks",
      items,
    });
  } catch (error) {
    console.error("GET /api/navigation/advanced-tracks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch advanced menu" },
      { status: 500 }
    );
  }
}
