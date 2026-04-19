import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";
import { auth } from "@/lib/auth";
import { runAutoApprovalSweepIfNeeded } from "@/lib/moderation";
import fs from "fs";
import path from "path";
import { getOneDriveItemMetadata } from "@/lib/onedrive";

const PUBLIC_ROOT = path.join(process.cwd(), "public");

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
function getImageMimeTypeFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".png")) return "image/png";
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
    if (pathname.endsWith(".webp")) return "image/webp";
    if (pathname.endsWith(".gif")) return "image/gif";
    if (pathname.endsWith(".avif")) return "image/avif";
  } catch {
    return null;
  }

  return null;
}

function resolvePublicPathFromUploadsUrl(fileUrl: string): string | null {
  if (!fileUrl.startsWith("/uploads/")) return null;

  const relativePath = fileUrl.replace(/^\/+/, "");
  if (!relativePath || relativePath.includes("..")) return null;

  const absolutePath = path.resolve(PUBLIC_ROOT, relativePath);
  const safeRoot = path.resolve(PUBLIC_ROOT) + path.sep;
  if (!absolutePath.startsWith(safeRoot)) return null;

  return absolutePath;
}

async function getContentLengthFromUrl(url: string): Promise<number> {
  try {
    const headRes = await fetch(url, { method: "HEAD" });
    const value = headRes.headers.get("content-length");
    return value ? Number(value) || 0 : 0;
  } catch {
    return 0;
  }
}

// GET /api/notes/[id] — Get single note
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    runAutoApprovalSweepIfNeeded();

    const session = await auth();
    const sessionUser = session?.user as { id?: string; role?: string } | undefined;
    const sessionRole = sessionUser?.role || "user";
    const isPrivileged = sessionRole === "admin" || sessionRole === "moderator";
    const client = getClient();

    const result = await client.execute({
      sql: `SELECT n.*, c.name as category_name, c.slug as category_slug,
            COALESCE(u.name, n.author_credit, 'Anonymous') as author_name, u.avatar as author_avatar, u.bio as author_bio
      FROM notes n
      LEFT JOIN categories c ON n.category_id = c.id
      LEFT JOIN users u ON n.author_id = u.id
      WHERE n.id = ?`,
      args: [id],
    });

    if (result.rows.length > 0) {
      const row = result.rows[0];

      const noteStatus = String(row.status || "pending");
      const isAuthor = Boolean(sessionUser?.id && row.author_id === sessionUser.id);
      if (noteStatus !== "approved" && !isPrivileged && !isAuthor) {
        return NextResponse.json({ error: "Note not found" }, { status: 404 });
      }

      // Increment view count
      await client.execute({
        sql: "UPDATE notes SET view_count = view_count + 1 WHERE id = ?",
        args: [id],
      });
      await client.execute({
        sql: "INSERT INTO views (note_id) VALUES (?)",
        args: [id],
      });

      const tagResult = await client.execute({
        sql: `SELECT t.name FROM note_tags nt JOIN tags t ON nt.tag_id = t.id WHERE nt.note_id = ?`,
        args: [id],
      });

      let resolvedFileSizeBytes = Number(row.file_size_bytes) || 0;
      let resolvedFileName = String(row.file_name || "file");
      let resolvedFileType = String(row.file_type || "application/octet-stream");

      if (resolvedFileSizeBytes <= 0) {
        const driveItemId = String(row.drive_item_id || "").trim();
        const fileUrl = String(row.file_url || "");

        if (driveItemId) {
          try {
            const metadata = await getOneDriveItemMetadata(driveItemId);
            resolvedFileSizeBytes = metadata.sizeBytes;
            resolvedFileName = metadata.name || resolvedFileName;
            resolvedFileType = metadata.mimeType || resolvedFileType;
          } catch {
            // Fallbacks below.
          }
        }

        if (resolvedFileSizeBytes <= 0 && fileUrl.startsWith("/uploads/")) {
          const filePath = resolvePublicPathFromUploadsUrl(fileUrl);
          if (filePath && fs.existsSync(filePath)) {
            resolvedFileSizeBytes = fs.statSync(filePath).size;
          }
        }
        if (
          resolvedFileSizeBytes <= 0 &&
          (fileUrl.startsWith("http://") || fileUrl.startsWith("https://"))
        ) {
          resolvedFileSizeBytes = await getContentLengthFromUrl(fileUrl);
        }
      }

      const note = {
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category_name,
        categorySlug: row.category_slug,
        author: row.author_name,
        authorAvatar: row.author_avatar,
        authorBio: row.author_bio,
        authorId: row.author_id,
        authorCredit: row.author_credit,
        thumbnailUrl: row.thumbnail_url,
        fileUrl: row.file_url,
        fileName: resolvedFileName,
        fileType: resolvedFileType,
        fileSizeBytes: resolvedFileSizeBytes,
        sourceUrl: row.source_url,
        licenseType: row.license_type,
        status: row.status,
        featured: row.featured === 1,
        viewCount: (Number(row.view_count) || 0) + 1,
        bookmarkCount: row.bookmark_count,
        tags: tagResult.rows.map((t) => String(t.name)),
        createdAt: row.created_at,
      };

      return NextResponse.json({ note });
    }

    const advancedResult = await client.execute({
      sql: `SELECT
            atr.*,
            at.name as track_name,
            at.slug as track_slug,
            at.status as track_status,
            u.name as author_name,
            u.avatar as author_avatar,
            u.bio as author_bio
          FROM advanced_track_resources atr
          JOIN advanced_tracks at ON atr.track_id = at.id
          LEFT JOIN users u ON atr.author_id = u.id
          WHERE atr.id = ?
          LIMIT 1`,
      args: [id],
    });

    if (advancedResult.rows.length === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const advancedRow = advancedResult.rows[0] as Record<string, unknown>;
    const advancedStatus = String(advancedRow.status || "pending");
    const trackStatus = String(advancedRow.track_status || "active");
    const isAdvancedAuthor = Boolean(
      sessionUser?.id && String(advancedRow.author_id || "") === sessionUser.id
    );

    if (
      !isPrivileged &&
      !isAdvancedAuthor &&
      (advancedStatus !== "approved" || trackStatus !== "active")
    ) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    await client.execute({
      sql: "UPDATE advanced_track_resources SET view_count = view_count + 1 WHERE id = ?",
      args: [id],
    });

    const advancedTagsResult = await client.execute({
      sql: `SELECT tag FROM advanced_track_resource_tags WHERE resource_id = ? ORDER BY tag ASC`,
      args: [id],
    });

    const resourceType = String(advancedRow.resource_type || "link");
    const contentUrl = String(advancedRow.content_url || "");
    const isDirectLink = contentUrl.startsWith("http://") || contentUrl.startsWith("https://");

    let resolvedFileSizeBytes = 0;
    let resolvedFileName = `${String(advancedRow.title || "resource")}.${resourceType}`;
    let resolvedFileType =
      resourceType === "pdf"
        ? "application/pdf"
        : resourceType === "image"
          ? "image/png"
          : "link";

    if (contentUrl.startsWith("onedrive://")) {
      const driveItemId = contentUrl.replace("onedrive://", "").trim();
      if (driveItemId) {
        try {
          const metadata = await getOneDriveItemMetadata(driveItemId);
          resolvedFileSizeBytes = metadata.sizeBytes;
          resolvedFileName = metadata.name || resolvedFileName;
          resolvedFileType = metadata.mimeType || resolvedFileType;
        } catch {
          // Ignore metadata failures and keep defaults.
        }
      }
    } else if (contentUrl.startsWith("/uploads/")) {
      const filePath = resolvePublicPathFromUploadsUrl(contentUrl);
      if (filePath && fs.existsSync(filePath)) {
        resolvedFileSizeBytes = fs.statSync(filePath).size;
      }
    } else if (isDirectLink) {
      resolvedFileSizeBytes = await getContentLengthFromUrl(contentUrl);
      if (resourceType === "link") {
        const directImageMimeType = getImageMimeTypeFromUrl(contentUrl);
        if (directImageMimeType) {
          resolvedFileType = directImageMimeType;
        }
      }
    }

    const advancedFileUrl =
      resourceType === "pdf"
        ? `/api/advanced-tracks/resource/${id}`
        : isDirectLink
          ? contentUrl
          : `/api/advanced-tracks/resource/${id}`;

    const note = {
      id: String(advancedRow.id || id),
      title: String(advancedRow.title || "Untitled"),
      description: String(advancedRow.summary || ""),
      category: String(advancedRow.track_name || "Advanced"),
      categorySlug: String(advancedRow.track_slug || "advanced"),
      author: String(advancedRow.author_name || "Unknown author"),
      authorAvatar: (advancedRow.author_avatar as string | null) || null,
      authorBio: (advancedRow.author_bio as string | null) || null,
      authorId: String(advancedRow.author_id || ""),
      authorCredit: String(advancedRow.author_name || "Unknown author"),
      thumbnailUrl: String(advancedRow.thumbnail_url || ""),
      fileUrl: advancedFileUrl,
      fileName: resolvedFileName,
      fileType: resolvedFileType,
      fileSizeBytes: resolvedFileSizeBytes,
      sourceUrl: isDirectLink ? contentUrl : null,
      licenseType: "Open Access",
      status: advancedStatus,
      featured: Number(advancedRow.featured) === 1,
      viewCount: (Number(advancedRow.view_count) || 0) + 1,
      bookmarkCount: Number(advancedRow.save_count) || 0,
      tags: advancedTagsResult.rows.map((tagRow) => String(tagRow.tag)),
      createdAt: String(advancedRow.created_at || new Date().toISOString()),
    };

    return NextResponse.json({ note });
  } catch (error) {
    console.error("GET /api/notes/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
