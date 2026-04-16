import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";
import path from "path";
import fs from "fs";

const TOKEN_CACHE_PATH = path.join(process.cwd(), ".onedrive-token.json");
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function getClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!
  });
}

// GET /api/files/[noteId] — Serve file securely (proxy from OneDrive or local)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { noteId } = await params;

    const client = getClient();
    const result = await client.execute({
      sql: "SELECT file_url, file_type, file_name, drive_item_id, status FROM notes WHERE id = ?",
      args: [noteId]
    });

    const note = result.rows[0] as unknown as {
      file_url: string;
      file_type: string;
      file_name: string;
      drive_item_id: string | null;
      status: string;
    } | undefined;

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Only serve approved notes
    if (note.status !== "approved") {
      return NextResponse.json({ error: "Note not available" }, { status: 403 });
    }

    const action = req.nextUrl.searchParams.get("action") || "view";

    // ── OneDrive file (has drive_item_id) ──────────────────
    if (note.drive_item_id) {
      const token = await getAccessToken();
      
      // Get the direct download URL from Graph API
      const itemRes = await fetch(
        `${GRAPH_BASE}/me/drive/items/${note.drive_item_id}?$select=@microsoft.graph.downloadUrl,name,size`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!itemRes.ok) {
        console.error("Failed to get drive item:", await itemRes.text());
        return NextResponse.json({ error: "File not available" }, { status: 404 });
      }

      const item = await itemRes.json();
      const downloadUrl = item["@microsoft.graph.downloadUrl"];

      if (!downloadUrl) {
        return NextResponse.json({ error: "Download URL not available" }, { status: 500 });
      }

      if (action === "download") {
        // Redirect to temp download URL for downloads
        return NextResponse.redirect(downloadUrl);
      }

      // For view: proxy the content through our server (hides OneDrive URL)
      const fileRes = await fetch(downloadUrl);
      if (!fileRes.ok) {
        return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
      }

      const fileBuffer = await fileRes.arrayBuffer();
      
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": note.file_type || "application/octet-stream",
          "Content-Disposition": action === "download" 
            ? `attachment; filename="${note.file_name}"` 
            : "inline",
          "Cache-Control": "public, max-age=3600", // Cache for 1 hour
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // ── Local file ─────────────────────────────────────────
    if (note.file_url.startsWith("/uploads/")) {
      const filePath = path.join(process.cwd(), "public", note.file_url);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      const fileBuffer = fs.readFileSync(filePath);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": note.file_type || "application/octet-stream",
          "Content-Disposition": action === "download"
            ? `attachment; filename="${note.file_name}"`
            : "inline",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // ── External link — redirect ───────────────────────────
    if (note.file_url.startsWith("http")) {
      return NextResponse.redirect(note.file_url);
    }

    return NextResponse.json({ error: "File not available" }, { status: 404 });
  } catch (error) {
    console.error("File proxy error:", error);
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 });
  }
}

/* ── Token helper (reuse from onedrive.ts logic) ──────── */
async function getAccessToken(): Promise<string> {
  let refreshToken = process.env.ONEDRIVE_REFRESH_TOKEN || "";

  if (!refreshToken) {
    try {
      const raw = fs.readFileSync(TOKEN_CACHE_PATH, "utf-8");
      const cached = JSON.parse(raw);
      refreshToken = cached.refresh_token || "";
    } catch {
      throw new Error("No OneDrive token");
    }
  }

  const tenantId = process.env.ONEDRIVE_TENANT_ID || "common";
  const body = new URLSearchParams({
    client_id: process.env.ONEDRIVE_CLIENT_ID || "",
    client_secret: process.env.ONEDRIVE_CLIENT_SECRET || "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: "Files.ReadWrite offline_access",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }
  );

  if (!res.ok) throw new Error("Token refresh failed");
  const data = await res.json();

  // Update cached token safely
  if (data.refresh_token) {
    try {
      fs.writeFileSync(TOKEN_CACHE_PATH, JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
      }, null, 2));
    } catch (e) {
      console.warn("Failed to write to token cache (read-only FS on Vercel?)", e);
    }
  }

  return data.access_token;
}
