import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");

export async function GET() {
  let sqlite: Database.Database | null = null;

  try {
    sqlite = new Database(DB_PATH);
    sqlite.pragma("foreign_keys = ON");

    const trackRows = sqlite
      .prepare(
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
      )
      .all() as Array<{
      id: number;
      slug: string;
      name: string;
      description: string;
      premium: number;
      status: string;
      sort_order: number;
      approved_count: number;
    }>;

    const topicRows = sqlite
      .prepare(
        `SELECT id, track_id, slug, name, description, level, sort_order
         FROM advanced_track_topics
         ORDER BY sort_order ASC, name ASC`
      )
      .all() as Array<{
      id: number;
      track_id: number;
      slug: string;
      name: string;
      description: string;
      level: "Beginner" | "Intermediate" | "Advanced";
      sort_order: number;
    }>;

    const tracks = trackRows.map((track) => ({
      id: track.id,
      slug: track.slug,
      name: track.name,
      description: track.description,
      premium: Boolean(track.premium),
      approvedCount: track.approved_count || 0,
      topics: topicRows
        .filter((topic) => topic.track_id === track.id)
        .map((topic) => ({
          id: topic.id,
          slug: topic.slug,
          name: topic.name,
          description: topic.description,
          level: topic.level,
        })),
    }));

    return NextResponse.json({ tracks });
  } catch (error) {
    console.error("GET /api/advanced-tracks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch advanced tracks" },
      { status: 500 }
    );
  } finally {
    if (sqlite) sqlite.close();
  }
}
