import { NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";
import { getOneDriveItemDownloadInfo, isOneDriveConfigured } from "@/lib/onedrive";

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

// GET /api/profile-photo/[driveItemId] — stream avatar from OneDrive
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ driveItemId: string }> }
) {
  try {
    const { driveItemId: rawId } = await params;
    const driveItemId = decodeURIComponent(rawId || "").trim();

    if (!driveItemId || driveItemId.includes("/")) {
      return NextResponse.json({ error: "Invalid photo id" }, { status: 400 });
    }

    const avatarPath = `/api/profile-photo/${driveItemId}`;

    // Only serve drive item IDs that are actually linked as user avatars.
    const client = getClient();
    const result = await client.execute({
      sql: "SELECT id FROM users WHERE avatar = ? LIMIT 1",
      args: [avatarPath],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    if (!isOneDriveConfigured()) {
      return NextResponse.json({ error: "OneDrive not configured" }, { status: 503 });
    }

    const item = await getOneDriveItemDownloadInfo(driveItemId);
    const fileRes = await fetch(item.downloadUrl);

    if (!fileRes.ok) {
      return NextResponse.json({ error: "Failed to fetch photo" }, { status: 502 });
    }

    const fileBuffer = await fileRes.arrayBuffer();
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": item.mimeType,
        "Content-Disposition": `inline; filename="${item.name}"`,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("GET /api/profile-photo/[driveItemId] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
