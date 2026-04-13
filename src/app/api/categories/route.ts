import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");

// GET /api/categories — List all categories with live note counts
export async function GET() {
  try {
    const sqlite = new Database(DB_PATH, { readonly: true });
    const rows = sqlite.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM notes n WHERE n.category_id = c.id AND n.status = 'approved') as live_count
      FROM categories c
      ORDER BY live_count DESC
    `).all() as Record<string, unknown>[];
    sqlite.close();

    const categories = rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      icon: r.icon,
      gradient: r.gradient,
      noteCount: r.live_count || 0,
    }));

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("GET /api/categories error:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}
