import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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

async function ensureSettingsTable(client: ReturnType<typeof getClient>) {
  await client.execute(
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  );
}

// GET /api/admin/settings — Get all admin settings
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionRole = (session.user as { role?: string }).role || "user";
    if (sessionRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const client = getClient();
    await ensureSettingsTable(client);

    const result = await client.execute("SELECT key, value FROM settings");

    const settings: Record<string, string> = {};
    for (const row of result.rows) {
      settings[String(row.key)] = String(row.value);
    }

    return NextResponse.json({
      settings: {
        auto_approve_enabled: settings.auto_approve_enabled === "true",
      },
    });
  } catch (error) {
    console.error("GET /api/admin/settings error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT /api/admin/settings — Update a setting
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionRole = (session.user as { role?: string }).role || "user";
    if (sessionRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { key, value } = body as { key: string; value: string };

    const allowedKeys = ["auto_approve_enabled"];
    if (!allowedKeys.includes(key)) {
      return NextResponse.json({ error: "Invalid setting key" }, { status: 400 });
    }

    const client = getClient();
    await ensureSettingsTable(client);

    await client.execute({
      sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [key, value],
    });

    // If auto-approval was just turned ON, approve all currently pending notes
    if (key === "auto_approve_enabled" && value === "true") {
      const result = await client.execute(
        `UPDATE notes SET status = 'approved', updated_at = datetime('now') WHERE status = 'pending'`
      );

      if (result.rowsAffected > 0) {
        // Refresh category counts
        await client.execute(
          `UPDATE categories SET note_count = (
            SELECT COUNT(*) FROM notes WHERE notes.category_id = categories.id AND notes.status = 'approved'
          )`
        );

        console.log(
          `[Settings] Auto-approval enabled. Approved ${result.rowsAffected} pending note(s).`
        );
      }

      return NextResponse.json({
        success: true,
        message: `Auto-approval enabled. ${result.rowsAffected} pending note(s) approved.`,
        approvedCount: result.rowsAffected,
      });
    }

    return NextResponse.json({ success: true, message: "Setting updated." });
  } catch (error) {
    console.error("PUT /api/admin/settings error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
