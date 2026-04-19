import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appendAdminActionToExcel } from "@/lib/excel";
import { createClient, type Client } from "@libsql/client/web";

export const dynamic = "force-dynamic";

function getClient(): Client {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("TURSO_DATABASE_URL is not configured");
  }

  return createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

function normalizeRecord(row: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    output[key] = typeof value === "bigint" ? Number(value) : value;
  }
  return output;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

async function ensureVideosTable(client: Client): Promise<void> {
  await client.execute({
    sql: `
      CREATE TABLE IF NOT EXISTS videos (
        id text PRIMARY KEY NOT NULL,
        title text NOT NULL,
        description text NOT NULL,
        category_id integer NOT NULL,
        author_id text NOT NULL,
        author_credit text NOT NULL,
        video_url text NOT NULL,
        video_type text NOT NULL DEFAULT 'youtube',
        video_id text NOT NULL,
        thumbnail_url text,
        duration text,
        license_type text NOT NULL DEFAULT 'CC-BY-4.0',
        status text NOT NULL DEFAULT 'pending',
        featured integer NOT NULL DEFAULT 0,
        view_count integer NOT NULL DEFAULT 0,
        created_at text NOT NULL DEFAULT (datetime('now')),
        updated_at text NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (category_id) REFERENCES categories(id),
        FOREIGN KEY (author_id) REFERENCES users(id)
      )
    `,
    args: [],
  });
}

async function requireModeratorSession() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const sessionRole = (session.user as { role?: string }).role || "user";
  if (sessionRole !== "admin" && sessionRole !== "moderator") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session, sessionRole };
}

// GET /api/admin/videos — List all videos for moderation
export async function GET() {
  try {
    const authResult = await requireModeratorSession();
    if ("error" in authResult) return authResult.error;

    const client = getClient();
    await ensureVideosTable(client);

    const result = await client.execute(`
      SELECT
        v.*, c.name as category_name,
        COALESCE(u.name, v.author_credit, 'Unknown') as author_name,
        COALESCE(u.email, '') as author_email
      FROM videos v
      LEFT JOIN categories c ON v.category_id = c.id
      LEFT JOIN users u ON v.author_id = u.id
      ORDER BY
        CASE v.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
        v.created_at DESC
    `);

    const videos = result.rows.map((row) => normalizeRecord(row as Record<string, unknown>));
    return NextResponse.json({ videos });
  } catch (error) {
    console.error("GET /api/admin/videos error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH /api/admin/videos — Update video status (approve/reject/feature)
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireModeratorSession();
    if ("error" in authResult) return authResult.error;

    const { session } = authResult;
    const client = getClient();
    await ensureVideosTable(client);

    const { videoId, action, featured } = (await req.json()) as {
      videoId?: string;
      action?: "approve" | "reject" | "unpublish" | "feature";
      featured?: boolean;
    };

    const normalizedVideoId = typeof videoId === "string" ? videoId.trim() : "";
    if (!normalizedVideoId || !action) {
      return NextResponse.json({ error: "Missing videoId/action" }, { status: 400 });
    }

    const existingResult = await client.execute({
      sql: "SELECT status, featured, title, category_id FROM videos WHERE id = ? LIMIT 1",
      args: [normalizedVideoId],
    });

    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const existing = normalizeRecord(existingResult.rows[0] as Record<string, unknown>) as {
      status: string;
      featured: number;
      title: string;
      category_id: number;
    };

    if (action === "approve") {
      await client.execute({
        sql: "UPDATE videos SET status = 'approved', updated_at = datetime('now') WHERE id = ?",
        args: [normalizedVideoId],
      });
    } else if (action === "reject") {
      await client.execute({
        sql: "UPDATE videos SET status = 'rejected', updated_at = datetime('now') WHERE id = ?",
        args: [normalizedVideoId],
      });
    } else if (action === "unpublish") {
      await client.execute({
        sql: "UPDATE videos SET status = 'pending', updated_at = datetime('now') WHERE id = ?",
        args: [normalizedVideoId],
      });
    } else if (action === "feature") {
      await client.execute({
        sql: "UPDATE videos SET featured = ?, updated_at = datetime('now') WHERE id = ?",
        args: [featured ? 1 : 0, normalizedVideoId],
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const categoryResult = await client.execute({
      sql: "SELECT name FROM categories WHERE id = ? LIMIT 1",
      args: [existing.category_id],
    });

    const categoryName = asString(categoryResult.rows[0]?.name, "Video");
    const nextStatus =
      action === "approve"
        ? "approved"
        : action === "reject"
          ? "rejected"
          : action === "unpublish"
            ? "pending"
            : existing.status;

    await appendAdminActionToExcel({
      adminId: (session.user.id as string) || "",
      adminName: session.user.name || "Admin",
      adminEmail: session.user.email || "",
      noteId: normalizedVideoId,
      noteTitle: existing.title,
      category: categoryName,
      action:
        action === "feature"
          ? "featured"
          : action === "approve"
            ? "approved"
            : action === "unpublish"
              ? "unpublished"
              : "rejected",
      previousStatus: existing.status,
      newStatus: nextStatus,
      featured: action === "feature" ? Boolean(featured) : Boolean(existing.featured),
      details:
        action === "feature"
          ? `Video featured toggled to ${featured ? "on" : "off"}`
          : `Video status changed to ${nextStatus}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/admin/videos error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/admin/videos — Permanently delete video (admin only)
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireModeratorSession();
    if ("error" in authResult) return authResult.error;

    const { session, sessionRole } = authResult;
    if (sessionRole !== "admin") {
      return NextResponse.json({ error: "Only admins can delete videos" }, { status: 403 });
    }

    const payload = (await req.json()) as { videoId?: string };
    const videoId = typeof payload.videoId === "string" ? payload.videoId.trim() : "";
    if (!videoId) {
      return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
    }

    const client = getClient();
    await ensureVideosTable(client);

    const existingResult = await client.execute({
      sql: "SELECT title, status, featured, category_id FROM videos WHERE id = ? LIMIT 1",
      args: [videoId],
    });

    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const existing = normalizeRecord(existingResult.rows[0] as Record<string, unknown>) as {
      title: string;
      status: string;
      featured: number;
      category_id: number;
    };

    await client.execute({
      sql: "DELETE FROM videos WHERE id = ?",
      args: [videoId],
    });

    const categoryResult = await client.execute({
      sql: "SELECT name FROM categories WHERE id = ? LIMIT 1",
      args: [asNumber(existing.category_id, 0)],
    });

    await appendAdminActionToExcel({
      adminId: (session.user.id as string) || "",
      adminName: session.user.name || "Admin",
      adminEmail: session.user.email || "",
      noteId: videoId,
      noteTitle: asString(existing.title, "Untitled Video"),
      category: asString(categoryResult.rows[0]?.name, "Video"),
      action: "deleted",
      previousStatus: asString(existing.status, "approved"),
      newStatus: "deleted",
      featured: Boolean(existing.featured),
      details: "Permanent video deletion from admin panel",
    });

    return NextResponse.json({ success: true, videoId });
  } catch (error) {
    console.error("DELETE /api/admin/videos error:", error);
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
