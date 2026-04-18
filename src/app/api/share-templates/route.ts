import { NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";

export const dynamic = "force-dynamic";

// GET /api/share-templates — Public endpoint to fetch share templates
export async function GET() {
  try {
    const databaseUrl = process.env.TURSO_DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json({ templates: {} });
    }

    const client = createClient({
      url: databaseUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    const result = await client.execute({
      sql: "SELECT key, value FROM settings WHERE key LIKE 'share_template_%'",
      args: [],
    });

    const templates: Record<string, string> = {};
    for (const row of result.rows) {
      const key = String(row.key).replace("share_template_", "");
      const value = String(row.value);
      if (value) templates[key] = value;
    }

    return NextResponse.json({ templates });
  } catch {
    // If settings table doesn't exist yet, return empty
    return NextResponse.json({ templates: {} });
  }
}
