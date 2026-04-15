import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");

export async function GET() {
  let sqlite: Database.Database | null = null;

  try {
    sqlite = new Database(DB_PATH);
    sqlite.pragma("foreign_keys = ON");

    const rows = sqlite
      .prepare(
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
      )
      .all() as Array<{
      slug: string;
      name: string;
      description: string;
      approved_count: number;
    }>;

    const items = [
      {
        id: "advanced-library",
        label: "Open Tracks Library",
        description: "Premium advanced learning paths",
        href: "/tracks/library",
        count: rows.reduce((sum, row) => sum + (row.approved_count || 0), 0),
      },
      ...rows.map((row) => ({
        id: `advanced-${row.slug}`,
        label: `${row.name} Notes`,
        description: row.description,
        href: `/tracks/notes?track=${row.slug}`,
        count: row.approved_count || 0,
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
  } finally {
    if (sqlite) sqlite.close();
  }
}
