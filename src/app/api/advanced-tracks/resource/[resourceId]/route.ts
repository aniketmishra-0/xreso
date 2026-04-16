import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { auth } from "@/lib/auth";
import { getOneDriveItemDownloadInfo } from "@/lib/onedrive";
import { runAutoApprovalSweepIfNeeded } from "@/lib/moderation";

const DB_PATH = path.join(process.cwd(), "xreso.db");

type ViewerRole = "admin" | "moderator" | "user" | "guest";

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
    isPrivileged:
      viewerRole === "admin" || viewerRole === "moderator",
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  let sqlite: Database.Database | null = null;

  try {
    const { resourceId } = await params;
    if (!resourceId) {
      return NextResponse.json({ error: "resourceId is required" }, { status: 400 });
    }

    runAutoApprovalSweepIfNeeded();

    sqlite = new Database(DB_PATH);
    sqlite.pragma("foreign_keys = ON");

    const access = await getViewerAccess();

    const resource = sqlite
      .prepare(
        `SELECT
          atr.content_url,
          atr.status,
          at.status as track_status
         FROM advanced_track_resources atr
         JOIN advanced_tracks at ON atr.track_id = at.id
         WHERE atr.id = ?`
      )
      .get(resourceId) as
      | {
          content_url: string;
          status: string;
          track_status: string;
        }
      | undefined;

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    if (!access.isPrivileged) {
      if (resource.status !== "approved" || resource.track_status !== "active") {
        return NextResponse.json({ error: "Resource not available" }, { status: 404 });
      }
    }

    const contentUrl = typeof resource.content_url === "string" ? resource.content_url.trim() : "";
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
      const relativePath = contentUrl.replace(/^\/+/, "");
      const absolutePath = path.join(process.cwd(), "public", relativePath);
      if (!fs.existsSync(absolutePath)) {
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
  } finally {
    if (sqlite) sqlite.close();
  }
}
