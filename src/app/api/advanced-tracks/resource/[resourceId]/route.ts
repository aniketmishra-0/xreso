import { NextRequest, NextResponse } from "next/server";
import { createClient, Client } from "@libsql/client/web";
import fs from "fs";
import os from "os";
import path from "path";
import { auth } from "@/lib/auth";
import { getOneDriveItemDownloadInfo } from "@/lib/onedrive";
import { runAutoApprovalSweepIfNeeded } from "@/lib/moderation";

const TMP_ADVANCED_UPLOAD_DIR = path.join(os.tmpdir(), "xreso_advanced_uploads");

type ViewerRole = "admin" | "moderator" | "user" | "guest";

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

function getMimeTypeFromPath(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".pdf") return "application/pdf";
  if (extension === ".doc") return "application/msword";
  if (extension === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (extension === ".mp4") return "video/mp4";
  if (extension === ".webm") return "video/webm";

  return "application/octet-stream";
}

async function getViewerAccess() {
  const session = await auth();
  const sessionUser = session?.user as
    | {
        id?: string;
        role?: string;
      }
    | undefined;

  const viewerRole: ViewerRole =
    sessionUser?.role === "admin" || sessionUser?.role === "moderator"
      ? sessionUser.role
      : sessionUser?.role === "user"
        ? "user"
        : "guest";

  return {
    isPrivileged: viewerRole === "admin" || viewerRole === "moderator",
  };
}

function resolveLocalAdvancedPath(contentUrl: string) {
  if (!contentUrl.startsWith("/uploads/")) {
    return "";
  }

  const relativePath = contentUrl.replace(/^\/+/, "");
  const publicPath = path.join(process.cwd(), "public", relativePath);
  if (fs.existsSync(publicPath)) return publicPath;

  const fileName = path.basename(contentUrl);
  const tmpPath = path.join(TMP_ADVANCED_UPLOAD_DIR, fileName);
  if (fs.existsSync(tmpPath)) return tmpPath;

  return "";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  try {
    const { resourceId } = await params;
    if (!resourceId) {
      return NextResponse.json({ error: "resourceId is required" }, { status: 400 });
    }

    runAutoApprovalSweepIfNeeded();

    const client = getClient();
    const access = await getViewerAccess();

    const resourceResult = await client.execute({
      sql: `SELECT
          atr.content_url,
          atr.status,
          at.status as track_status
         FROM advanced_track_resources atr
         JOIN advanced_tracks at ON atr.track_id = at.id
         WHERE atr.id = ?
         LIMIT 1`,
      args: [resourceId],
    });

    if (resourceResult.rows.length === 0) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    const row = resourceResult.rows[0] as Record<string, unknown>;
    const status = typeof row.status === "string" ? row.status : "pending";
    const trackStatus = typeof row.track_status === "string" ? row.track_status : "active";

    if (!access.isPrivileged) {
      if (status !== "approved" || trackStatus !== "active") {
        return NextResponse.json({ error: "Resource not available" }, { status: 404 });
      }
    }

    const contentUrl = typeof row.content_url === "string" ? row.content_url.trim() : "";
    if (!contentUrl) {
      return NextResponse.json({ error: "Resource URL not available" }, { status: 404 });
    }

    if (contentUrl.startsWith("onedrive://")) {
      const driveItemId = contentUrl.replace("onedrive://", "").trim();
      if (!driveItemId) {
        return NextResponse.json({ error: "Invalid OneDrive resource reference" }, { status: 404 });
      }

      const downloadInfo = await getOneDriveItemDownloadInfo(driveItemId);
      return NextResponse.redirect(downloadInfo.downloadUrl);
    }

    if (contentUrl.startsWith("/uploads/")) {
      const absolutePath = resolveLocalAdvancedPath(contentUrl);
      if (!absolutePath) {
        return NextResponse.json({ error: "Resource file not found" }, { status: 404 });
      }

      const action = req.nextUrl.searchParams.get("action") || "view";
      const fileName = path.basename(absolutePath);
      const fileBuffer = fs.readFileSync(absolutePath);

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": getMimeTypeFromPath(absolutePath),
          "Content-Disposition":
            action === "download"
              ? `attachment; filename="${fileName}"`
              : "inline",
          "Cache-Control": "private, max-age=0, must-revalidate",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (contentUrl.startsWith("http://") || contentUrl.startsWith("https://")) {
      return NextResponse.redirect(contentUrl);
    }

    return NextResponse.json({ error: "Unsupported resource URL" }, { status: 404 });
  } catch (error) {
    console.error("GET /api/advanced-tracks/resource/[resourceId] error:", error);
    return NextResponse.json({ error: "Failed to serve advanced resource" }, { status: 500 });
  }
}
