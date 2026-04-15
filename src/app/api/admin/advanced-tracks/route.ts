import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");

type AdminRole = "admin" | "moderator" | "user";

type UpdateAction = "approve" | "reject" | "archive" | "feature" | "unfeature";

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("foreign_keys = ON");

  const roleRow = sqlite
    .prepare("SELECT role FROM users WHERE id = ?")
    .get(session.user.id) as { role?: AdminRole } | undefined;

  if (!roleRow || (roleRow.role !== "admin" && roleRow.role !== "moderator")) {
    sqlite.close();
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, sqlite };
}

export async function GET() {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const { sqlite } = admin;

  try {
    const tracks = sqlite
      .prepare(
        `SELECT id, slug, name, description, premium, status, sort_order
         FROM advanced_tracks
         ORDER BY sort_order ASC, name ASC`
      )
      .all();

    const topics = sqlite
      .prepare(
        `SELECT id, track_id, slug, name, description, level, sort_order
         FROM advanced_track_topics
         ORDER BY sort_order ASC, name ASC`
      )
      .all();

    const resources = sqlite
      .prepare(
        `SELECT
          atr.id,
          atr.title,
          atr.summary,
          atr.resource_type,
          atr.content_url,
          atr.thumbnail_url,
          atr.premium_only,
          atr.featured,
          atr.status,
          atr.view_count,
          atr.save_count,
          atr.created_at,
          atr.updated_at,
          at.slug as track_slug,
          at.name as track_name,
          att.slug as topic_slug,
          att.name as topic_name,
          u.name as author_name,
          GROUP_CONCAT(DISTINCT atrt.tag) as tag_names
         FROM advanced_track_resources atr
         JOIN advanced_tracks at ON atr.track_id = at.id
         LEFT JOIN advanced_track_topics att ON atr.topic_id = att.id
         LEFT JOIN users u ON atr.author_id = u.id
         LEFT JOIN advanced_track_resource_tags atrt ON atrt.resource_id = atr.id
         GROUP BY atr.id
         ORDER BY
           CASE atr.status
             WHEN 'pending' THEN 0
             WHEN 'approved' THEN 1
             WHEN 'draft' THEN 2
             WHEN 'rejected' THEN 3
             ELSE 4
           END,
           atr.created_at DESC`
      )
      .all();

    return NextResponse.json({ tracks, topics, resources });
  } catch (error) {
    console.error("GET /api/admin/advanced-tracks error:", error);
    return NextResponse.json(
      { error: "Failed to load advanced track admin data" },
      { status: 500 }
    );
  } finally {
    sqlite.close();
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const { session, sqlite } = admin;
  const authorId = session.user?.id;

  if (!authorId) {
    sqlite.close();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = (await req.json()) as {
      title?: unknown;
      summary?: unknown;
      contentUrl?: unknown;
      trackSlug?: unknown;
      topicSlug?: unknown;
      thumbnailUrl?: unknown;
      resourceType?: unknown;
      premiumOnly?: unknown;
      featured?: unknown;
      status?: unknown;
      tags?: unknown;
    };

    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const summary = typeof payload.summary === "string" ? payload.summary.trim() : "";
    const contentUrl =
      typeof payload.contentUrl === "string" ? payload.contentUrl.trim() : "";
    const trackSlug =
      typeof payload.trackSlug === "string" ? payload.trackSlug.trim() : "";
    const topicSlug =
      typeof payload.topicSlug === "string" ? payload.topicSlug.trim() : "";
    const thumbnailUrl =
      typeof payload.thumbnailUrl === "string" ? payload.thumbnailUrl.trim() : "";

    const resourceType =
      payload.resourceType === "pdf" ||
      payload.resourceType === "doc" ||
      payload.resourceType === "video"
        ? payload.resourceType
        : "link";

    const premiumOnly = payload.premiumOnly !== false;
    const featured = payload.featured === true;
    const status =
      payload.status === "approved" ||
      payload.status === "draft" ||
      payload.status === "rejected" ||
      payload.status === "archived"
        ? payload.status
        : "pending";

    const tags = Array.isArray(payload.tags)
      ? payload.tags
          .map((tag: unknown) =>
            typeof tag === "string" ? tag.trim().toLowerCase() : ""
          )
          .filter(Boolean)
      : typeof payload.tags === "string"
        ? payload.tags
            .split(",")
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean)
        : [];

    if (!title || !summary || !contentUrl || !trackSlug) {
      return NextResponse.json(
        { error: "title, summary, trackSlug, and contentUrl are required" },
        { status: 400 }
      );
    }

    const track = sqlite
      .prepare("SELECT id FROM advanced_tracks WHERE slug = ?")
      .get(trackSlug) as { id: number } | undefined;

    if (!track) {
      return NextResponse.json({ error: "Invalid trackSlug" }, { status: 400 });
    }

    let topicId: number | null = null;
    if (topicSlug) {
      const topic = sqlite
        .prepare(
          "SELECT id FROM advanced_track_topics WHERE track_id = ? AND slug = ?"
        )
        .get(track.id, topicSlug) as { id: number } | undefined;

      if (!topic) {
        return NextResponse.json({ error: "Invalid topicSlug" }, { status: 400 });
      }
      topicId = topic.id;
    }

    const resourceId = uuidv4();

    sqlite
      .prepare(
        `INSERT INTO advanced_track_resources
          (id, track_id, topic_id, author_id, title, summary, resource_type, content_url, thumbnail_url, premium_only, featured, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        resourceId,
        track.id,
        topicId,
        authorId,
        title,
        summary,
        resourceType,
        contentUrl,
        thumbnailUrl || null,
        premiumOnly ? 1 : 0,
        featured ? 1 : 0,
        status
      );

    if (tags.length > 0) {
      const insertTag = sqlite.prepare(
        "INSERT OR IGNORE INTO advanced_track_resource_tags (resource_id, tag) VALUES (?, ?)"
      );
      tags.forEach((tag) => insertTag.run(resourceId, tag));
    }

    return NextResponse.json({ success: true, resourceId });
  } catch (error) {
    console.error("POST /api/admin/advanced-tracks error:", error);
    return NextResponse.json(
      { error: "Failed to create advanced track resource" },
      { status: 500 }
    );
  } finally {
    sqlite.close();
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const { sqlite } = admin;

  try {
    const payload = await req.json();
    const resourceId =
      typeof payload.resourceId === "string" ? payload.resourceId.trim() : "";
    const action = payload.action as UpdateAction;

    if (!resourceId || !action) {
      return NextResponse.json(
        { error: "resourceId and action are required" },
        { status: 400 }
      );
    }

    const allowedActions: UpdateAction[] = [
      "approve",
      "reject",
      "archive",
      "feature",
      "unfeature",
    ];

    if (!allowedActions.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action === "approve") {
      sqlite
        .prepare(
          "UPDATE advanced_track_resources SET status = 'approved', updated_at = datetime('now') WHERE id = ?"
        )
        .run(resourceId);
    } else if (action === "reject") {
      sqlite
        .prepare(
          "UPDATE advanced_track_resources SET status = 'rejected', updated_at = datetime('now') WHERE id = ?"
        )
        .run(resourceId);
    } else if (action === "archive") {
      sqlite
        .prepare(
          "UPDATE advanced_track_resources SET status = 'archived', updated_at = datetime('now') WHERE id = ?"
        )
        .run(resourceId);
    } else if (action === "feature") {
      sqlite
        .prepare(
          "UPDATE advanced_track_resources SET featured = 1, updated_at = datetime('now') WHERE id = ?"
        )
        .run(resourceId);
    } else if (action === "unfeature") {
      sqlite
        .prepare(
          "UPDATE advanced_track_resources SET featured = 0, updated_at = datetime('now') WHERE id = ?"
        )
        .run(resourceId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/admin/advanced-tracks error:", error);
    return NextResponse.json(
      { error: "Failed to update advanced track resource" },
      { status: 500 }
    );
  } finally {
    sqlite.close();
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const { sqlite } = admin;

  try {
    const payload = await req.json();
    const resourceId =
      typeof payload.resourceId === "string" ? payload.resourceId.trim() : "";

    if (!resourceId) {
      return NextResponse.json({ error: "resourceId is required" }, { status: 400 });
    }

    sqlite
      .prepare("DELETE FROM advanced_track_resources WHERE id = ?")
      .run(resourceId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/advanced-tracks error:", error);
    return NextResponse.json(
      { error: "Failed to delete advanced track resource" },
      { status: 500 }
    );
  } finally {
    sqlite.close();
  }
}
