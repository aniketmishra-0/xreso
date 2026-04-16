import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";
import path from "path";
import fs from "fs";
import os from "os";

const TOKEN_CACHE_PATH = path.join(process.cwd(), ".onedrive-token.json");
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TMP_UPLOAD_DIR = path.join(os.tmpdir(), "xreso_uploads");
const TMP_THUMB_DIR = path.join(TMP_UPLOAD_DIR, "thumbs");

function getClient() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("TURSO_DATABASE_URL is not configured");
  }

  return createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "");
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const column = columnName.toLowerCase();
  return (
    message.includes(`no such column: ${column}`) ||
    message.includes(`has no column named ${column}`) ||
    message.includes(`unknown column: ${column}`) ||
    message.includes(`unknown field: ${column}`)
  );
}

function isStorageConfigError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("turso_database_url is not configured");
}

type NoteFileRow = {
  file_url: string;
  file_type: string;
  file_name: string;
  drive_item_id: string | null;
  status: string;
};

async function getNoteFileRow(noteId: string): Promise<NoteFileRow | undefined> {
  const client = getClient();

  try {
    const result = await client.execute({
      sql: "SELECT file_url, file_type, file_name, drive_item_id, status FROM notes WHERE id = ?",
      args: [noteId]
    });

    return result.rows[0] as unknown as NoteFileRow | undefined;
  } catch (error) {
    if (!isMissingColumnError(error, "drive_item_id")) {
      throw error;
    }

    const fallbackResult = await client.execute({
      sql: "SELECT file_url, file_type, file_name, status FROM notes WHERE id = ?",
      args: [noteId]
    });

    if (fallbackResult.rows.length === 0) return undefined;

    const row = fallbackResult.rows[0] as unknown as Omit<NoteFileRow, "drive_item_id">;
    return {
      ...row,
      drive_item_id: null,
    };
  }
}

function findTempUploadFilePath(noteId: string, action: string): string | null {
  if (action === "thumb") {
    const thumbPath = path.join(TMP_THUMB_DIR, `thumb_${noteId}.webp`);
    return fs.existsSync(thumbPath) ? thumbPath : null;
  }

  if (!fs.existsSync(TMP_UPLOAD_DIR)) return null;

  const prefix = `${noteId}.`;
  const matchedFile = fs
    .readdirSync(TMP_UPLOAD_DIR)
    .find((entry) => entry.startsWith(prefix));

  if (!matchedFile) return null;

  const absolutePath = path.join(TMP_UPLOAD_DIR, matchedFile);
  return fs.existsSync(absolutePath) ? absolutePath : null;
}

// GET /api/files/[noteId] — Serve file securely (proxy from OneDrive or local)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { noteId } = await params;
    const note = await getNoteFileRow(noteId);

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
        `${GRAPH_BASE}/me/drive/items/${note.drive_item_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!itemRes.ok) {
        console.error("Failed to get drive item:", await itemRes.text());
        return NextResponse.json({ error: "File not available" }, { status: 404 });
      }

      const item = await itemRes.json();
      const downloadUrl = item["@microsoft.graph.downloadUrl"];

      if (!downloadUrl) {
        console.error("Missing downloadUrl in item:", item);
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

    const tempFilePath = findTempUploadFilePath(noteId, action);
    if (tempFilePath) {
      const fileBuffer = fs.readFileSync(tempFilePath);
      const defaultType = action === "thumb" ? "image/webp" : "application/octet-stream";
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": note.file_type || defaultType,
          "Content-Disposition": action === "download"
            ? `attachment; filename="${note.file_name}"`
            : "inline",
          "Cache-Control": "public, max-age=3600",
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
    if (isStorageConfigError(error)) {
      return NextResponse.json(
        { error: "File storage service is not configured." },
        { status: 503 }
      );
    }
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
    } catch {
      // Expected on Vercel — read-only filesystem
    }
  }

  return data.access_token;
}
