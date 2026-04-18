import { NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";

export const dynamic = "force-dynamic";

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

export async function GET() {
  try {
    const client = getClient();
    
    // Attempt to read from settings. Since this is public, we fail gracefully.
    try {
      const result = await client.execute("SELECT key, value FROM settings WHERE key LIKE 'share_template_%'");
      const templates: Record<string, string> = {};
      
      for (const row of result.rows) {
        const key = String(row.key).replace("share_template_", "");
        templates[key] = String(row.value);
      }
      
      return NextResponse.json({ templates });
    } catch {
      // Table might not exist yet, just return empty templates
      return NextResponse.json({ templates: {} });
    }
  } catch (error) {
    console.error("GET /api/upload/settings error:", error);
    return NextResponse.json({ templates: {} });
  }
}
