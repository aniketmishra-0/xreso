import { NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";

function getClient() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("TURSO_DATABASE_URL is not configured");
  }

  return createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
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

// GET /api/categories — List all categories with live note counts
export async function GET() {
  try {
    const client = getClient();
    const hideTestDraft = await shouldHideTestDraftPublicContent(client);
    const result = await client.execute(`
      SELECT c.*,
        (SELECT COUNT(*)
         FROM notes n
         WHERE n.category_id = c.id
           AND n.status = 'approved'
           ${hideTestDraft ? "AND LENGTH(TRIM(n.title)) >= 5" : ""}) as live_count
      FROM categories c
      ORDER BY live_count DESC
    `);

    const categories = result.rows.map((r) => ({
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
