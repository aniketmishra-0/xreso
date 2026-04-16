import { after, NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import {
  deleteOneDriveItem,
  isOneDriveConfigured,
  uploadToOneDrive,
} from "@/lib/onedrive";
import { appendAdvancedLinkToExcel } from "@/lib/excel";
import { runAutoApprovalSweepIfNeeded } from "@/lib/moderation";

const DB_PATH = path.join(process.cwd(), "xreso.db");
const ADVANCED_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "advanced");
const ADVANCED_MAX_FILE_SIZE = 25 * 1024 * 1024;

export const maxDuration = 300;

type ResourceType = "link" | "pdf" | "doc" | "video";

type UpdateAction = "approve" | "reject" | "archive" | "feature" | "unfeature";

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return fallback;
}

function parseStatus(
  value: unknown
): "approved" | "draft" | "rejected" | "archived" | "pending" {
  if (
    value === "approved" ||
    value === "draft" ||
    value === "rejected" ||
    value === "archived"
  ) {
    return value;
  }
  return "pending";
}

function parseResourceType(value: unknown): ResourceType {
  if (value === "pdf" || value === "doc" || value === "video") {
    return value;
  }
  return "link";
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((tag: unknown) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function inferResourceTypeFromFile(file: File): Exclude<ResourceType, "link"> | null {
  const mimeType = file.type.toLowerCase();
  const extension = path.extname(file.name).slice(1).toLowerCase();

  if (mimeType === "application/pdf" || extension === "pdf") {
    return "pdf";
  }

  if (
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "doc" ||
    extension === "docx"
  ) {
    return "doc";
  }

  if (mimeType.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(extension)) {
    return "video";
  }

  return null;
}

function getSafeFileExtension(fileName: string, fallback: string): string {
  const ext = path.extname(fileName).slice(1).toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext || fallback;
}

function ensureDir(targetDir: string) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
}

function syncAdvancedResourceToOneDriveInBackground(params: {
  resourceId: string;
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  trackSlug: string;
}) {
  after(async () => {
    try {
      const uploaded = await uploadToOneDrive(
        params.fileBuffer,
        params.fileName,
        params.mimeType,
        params.trackSlug
      );

      const sqlite = new Database(DB_PATH);
      sqlite.pragma("foreign_keys = ON");

      try {
        sqlite
          .prepare(
            "UPDATE advanced_track_resources SET content_url = ?, updated_at = datetime('now') WHERE id = ?"
          )
          .run(`onedrive://${uploaded.driveItemId}`, params.resourceId);
      } finally {
        sqlite.close();
      }

      console.log(
        `[AdvancedTracks] Background OneDrive sync complete for resource ${params.resourceId}`
      );
    } catch (error) {
      console.error(
        `[AdvancedTracks] Background OneDrive sync failed for resource ${params.resourceId}:`,
        error
      );
    }
  });
}

function deleteAdvancedLocalBackups(resourceId: string, contentUrl?: string) {
  const candidatePaths = new Set<string>();

  if (contentUrl?.startsWith("/uploads/advanced/")) {
    candidatePaths.add(
      path.join(process.cwd(), "public", contentUrl.replace(/^\/+/, ""))
    );
  }

  if (fs.existsSync(ADVANCED_UPLOAD_DIR)) {
    for (const entry of fs.readdirSync(ADVANCED_UPLOAD_DIR)) {
      if (entry.startsWith(`${resourceId}.`)) {
        candidatePaths.add(path.join(ADVANCED_UPLOAD_DIR, entry));
      }
    }
  }

  for (const candidatePath of candidatePaths) {
    if (!fs.existsSync(candidatePath)) continue;

    try {
      fs.unlinkSync(candidatePath);
    } catch {
      // Best effort cleanup; resource deletion already succeeded.
    }
  }
}

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const sessionRole = (session.user as { role?: string }).role || "user";
  if (sessionRole !== "admin" && sessionRole !== "moderator") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("foreign_keys = ON");
  return { session, sqlite };
}

export async function GET() {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const { sqlite } = admin;

  try {
    runAutoApprovalSweepIfNeeded();

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

  let uploadedFilePath: string | null = null;

  try {
    let uploadedFile: File | null = null;

    const payload = {
      title: undefined as unknown,
      summary: undefined as unknown,
      contentUrl: undefined as unknown,
      licenseType: undefined as unknown,
      trackSlug: undefined as unknown,
      topicSlug: undefined as unknown,
      thumbnailUrl: undefined as unknown,
      resourceType: undefined as unknown,
      premiumOnly: undefined as unknown,
      featured: undefined as unknown,
      status: undefined as unknown,
      tags: undefined as unknown,
    };

    const contentTypeHeader = req.headers.get("content-type") || "";
    if (contentTypeHeader.includes("multipart/form-data")) {
      const formData = await req.formData();
      const fileEntry = formData.get("file");
      uploadedFile = fileEntry instanceof File ? fileEntry : null;

      payload.title = formData.get("title");
      payload.summary = formData.get("summary");
      payload.contentUrl = formData.get("contentUrl");
      payload.licenseType = formData.get("licenseType");
      payload.trackSlug = formData.get("trackSlug");
      payload.topicSlug = formData.get("topicSlug");
      payload.thumbnailUrl = formData.get("thumbnailUrl");
      payload.resourceType = formData.get("resourceType");
      payload.premiumOnly = formData.get("premiumOnly");
      payload.featured = formData.get("featured");
      payload.status = formData.get("status");
      payload.tags = formData.get("tags");
    } else {
      const jsonPayload = (await req.json()) as {
        title?: unknown;
        summary?: unknown;
        contentUrl?: unknown;
        licenseType?: unknown;
        trackSlug?: unknown;
        topicSlug?: unknown;
        thumbnailUrl?: unknown;
        resourceType?: unknown;
        premiumOnly?: unknown;
        featured?: unknown;
        status?: unknown;
        tags?: unknown;
      };

      payload.title = jsonPayload.title;
      payload.summary = jsonPayload.summary;
      payload.contentUrl = jsonPayload.contentUrl;
      payload.licenseType = jsonPayload.licenseType;
      payload.trackSlug = jsonPayload.trackSlug;
      payload.topicSlug = jsonPayload.topicSlug;
      payload.thumbnailUrl = jsonPayload.thumbnailUrl;
      payload.resourceType = jsonPayload.resourceType;
      payload.premiumOnly = jsonPayload.premiumOnly;
      payload.featured = jsonPayload.featured;
      payload.status = jsonPayload.status;
      payload.tags = jsonPayload.tags;
    }

    const title = toTrimmedString(payload.title);
    const summary = toTrimmedString(payload.summary);
    let contentUrl = toTrimmedString(payload.contentUrl);
    const licenseType = toTrimmedString(payload.licenseType) || "CC-BY-4.0";
    const trackSlug = toTrimmedString(payload.trackSlug);
    const topicSlug = toTrimmedString(payload.topicSlug);
    let thumbnailUrl = toTrimmedString(payload.thumbnailUrl);

    let resourceType = parseResourceType(payload.resourceType);
    const premiumOnly = parseBoolean(payload.premiumOnly, false);
    const featured = parseBoolean(payload.featured, false);
    const status = parseStatus(payload.status);
    const tags = parseTags(payload.tags);

    if (!title || !summary || !trackSlug) {
      return NextResponse.json(
        { error: "title, summary, and trackSlug are required" },
        { status: 400 }
      );
    }

    if (uploadedFile) {
      if (uploadedFile.size > ADVANCED_MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File too large. Maximum size is 25MB for advanced uploads." },
          { status: 400 }
        );
      }

      const inferredType = inferResourceTypeFromFile(uploadedFile);
      if (!inferredType) {
        return NextResponse.json(
          { error: "Invalid file type. Allowed: PDF, DOC, DOCX, MP4, WEBM." },
          { status: 400 }
        );
      }
      resourceType = inferredType;
    }

    if (!uploadedFile && !contentUrl) {
      return NextResponse.json(
        { error: "contentUrl is required when no file is uploaded" },
        { status: 400 }
      );
    }

    const track = sqlite
      .prepare("SELECT id, name FROM advanced_tracks WHERE slug = ?")
      .get(trackSlug) as { id: number; name: string } | undefined;

    if (!track) {
      return NextResponse.json({ error: "Invalid trackSlug" }, { status: 400 });
    }

    let topicId: number | null = null;
    let topicName = "";
    if (topicSlug) {
      const topic = sqlite
        .prepare(
          "SELECT id, name FROM advanced_track_topics WHERE track_id = ? AND slug = ?"
        )
        .get(track.id, topicSlug) as { id: number; name: string } | undefined;

      if (!topic) {
        return NextResponse.json({ error: "Invalid topicSlug" }, { status: 400 });
      }
      topicId = topic.id;
      topicName = topic.name;
    }

    const resourceId = uuidv4();
    let backgroundSyncPayload:
      | {
          fileBuffer: Buffer;
          fileName: string;
          mimeType: string;
        }
      | null = null;

    if (uploadedFile) {
      const fallbackExtension =
        resourceType === "pdf" ? "pdf" : resourceType === "video" ? "mp4" : "doc";
      const extension = getSafeFileExtension(uploadedFile.name, fallbackExtension);
      const fileName = `${resourceId}.${extension}`;
      const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
      const mimeType = uploadedFile.type || "application/octet-stream";

      ensureDir(ADVANCED_UPLOAD_DIR);

      const filePath = path.join(ADVANCED_UPLOAD_DIR, fileName);
      fs.writeFileSync(filePath, fileBuffer);
      uploadedFilePath = filePath;

      contentUrl = `/uploads/advanced/${fileName}`;
      if (!thumbnailUrl && uploadedFile.type.startsWith("image/")) {
        thumbnailUrl = contentUrl;
      }

      if (isOneDriveConfigured()) {
        backgroundSyncPayload = {
          fileBuffer,
          fileName,
          mimeType,
        };
      }
    }

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

    const excelLink =
      contentUrl.startsWith("http://") || contentUrl.startsWith("https://")
        ? contentUrl
        : `${req.nextUrl.origin}/api/advanced-tracks/resource/${resourceId}`;
    const excelCategory = topicName
      ? `${track.name} / ${topicName}`
      : track.name;

    try {
      await appendAdvancedLinkToExcel({
        noteId: resourceId,
        title,
        description: summary,
        category: excelCategory,
        link: excelLink,
        author: session.user.name || "Admin",
        authorEmail: session.user.email || "",
        tags: tags.join(", "),
        license: licenseType,
        status,
      });
    } catch (excelError) {
      console.error("[Excel] append failed for advanced upload:", excelError);
    }

    if (backgroundSyncPayload) {
      syncAdvancedResourceToOneDriveInBackground({
        resourceId,
        fileBuffer: backgroundSyncPayload.fileBuffer,
        fileName: backgroundSyncPayload.fileName,
        mimeType: backgroundSyncPayload.mimeType,
        trackSlug,
      });
    }

    return NextResponse.json({
      success: true,
      resourceId,
      message: backgroundSyncPayload
        ? "Advanced resource saved locally and queued for background cloud sync."
        : "Advanced resource saved successfully.",
    });
  } catch (error) {
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
      } catch {
        // Best effort rollback for partially saved uploads.
      }
    }

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

    const existing = sqlite
      .prepare("SELECT content_url FROM advanced_track_resources WHERE id = ?")
      .get(resourceId) as { content_url?: string } | undefined;

    sqlite
      .prepare("DELETE FROM advanced_track_resources WHERE id = ?")
      .run(resourceId);

    const contentUrl = existing?.content_url || "";
    if (contentUrl.startsWith("onedrive://")) {
      const driveItemId = contentUrl.replace("onedrive://", "").trim();
      if (driveItemId) {
        try {
          await deleteOneDriveItem(driveItemId);
        } catch {
          // Best effort cleanup; DB record deletion already succeeded.
        }
      }
    }

    deleteAdvancedLocalBackups(resourceId, contentUrl);

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
