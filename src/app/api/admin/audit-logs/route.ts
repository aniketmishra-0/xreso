import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@libsql/client/web";

export const dynamic = "force-dynamic";

function getClient() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) throw new Error("TURSO_DATABASE_URL is not configured");
  return createClient({ url: databaseUrl, authToken: process.env.TURSO_AUTH_TOKEN });
}

// GET /api/admin/audit-logs — Fetch recent audit logs
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (session.user as { role?: string }).role || "user";
    if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const client = getClient();

    // Create table if not exists (lightweight, text only)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        admin_email TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT DEFAULT 'note',
        target_id TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await client.execute(`
      SELECT * FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 100
    `);

    const logs = result.rows.map((row) => {
      const r: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        r[k] = typeof v === "bigint" ? Number(v) : v;
      }
      return r;
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("GET /api/admin/audit-logs error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
