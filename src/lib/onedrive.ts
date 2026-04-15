/**
 * OneDrive integration via Microsoft Graph API
 * ─────────────────────────────────────────────
 * Uploads files to the owner's personal OneDrive.
 * Auto-creates category folders like:
 *   Xreso/Python/file.pdf
 *   Xreso/JavaScript/file.png
 *
 * Uses OAuth2 refresh-token flow so the server can
 * upload on behalf of the account owner silently.
 */

import fs from "fs";
import path from "path";

const TOKEN_CACHE_PATH = path.join(process.cwd(), ".onedrive-token.json");
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TENANT_ID = process.env.ONEDRIVE_TENANT_ID || "common";
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
const ROOT_FOLDER = "Xreso"; // Top-level folder in OneDrive
const USER_PHOTOS_FOLDER = `${ROOT_FOLDER}/UserPhotos`;

function sanitizeOneDriveFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/* ── Env helpers ────────────────────────────────────────── */
function getClientId() { return process.env.ONEDRIVE_CLIENT_ID || ""; }
function getClientSecret() { return process.env.ONEDRIVE_CLIENT_SECRET || ""; }
function getRedirectUri() { return process.env.ONEDRIVE_REDIRECT_URI || "http://localhost:3000/api/onedrive/callback"; }

function getStoredRefreshToken(): string {
  // First check env
  if (process.env.ONEDRIVE_REFRESH_TOKEN) return process.env.ONEDRIVE_REFRESH_TOKEN;
  // Then check file cache
  try {
    const raw = fs.readFileSync(TOKEN_CACHE_PATH, "utf-8");
    const data = JSON.parse(raw);
    return data.refresh_token || "";
  } catch {
    return "";
  }
}

function saveTokenCache(data: { access_token: string; refresh_token: string; expires_at: number }) {
  fs.writeFileSync(TOKEN_CACHE_PATH, JSON.stringify(data, null, 2));
}

/* ── In-memory token cache ──────────────────────────────── */
let cachedAccessToken = "";
let cachedExpiresAt = 0;

/* ── Token refresh ──────────────────────────────────────── */
async function getAccessToken(): Promise<string> {
  // Return cached if still valid (with 60s buffer)
  if (cachedAccessToken && Date.now() < cachedExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    throw new Error("OneDrive not configured. Visit /api/onedrive/setup to connect your account.");
  }

  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: "Files.ReadWrite offline_access",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("OneDrive token refresh failed:", err);
    throw new Error("Failed to refresh OneDrive token");
  }

  const data = await res.json();
  cachedAccessToken = data.access_token;
  cachedExpiresAt = Date.now() + data.expires_in * 1000;

  // Persist new refresh token (they rotate)
  if (data.refresh_token) {
    saveTokenCache({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: cachedExpiresAt,
    });
  }

  return cachedAccessToken;
}

/* ── Ensure folder exists ───────────────────────────────── */
async function ensureFolder(folderPath: string, token: string): Promise<void> {
  // folderPath like "Xreso/Python" — create each segment
  const segments = folderPath.split("/");
  let currentPath = "";

  for (const seg of segments) {
    const parentPath = currentPath ? `root:/${currentPath}:` : "root";
    currentPath = currentPath ? `${currentPath}/${seg}` : seg;

    const checkUrl = `${GRAPH_BASE}/me/drive/root:/${currentPath}`;
    const check = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (check.ok) continue; // Folder already exists

    // Create folder
    const createUrl = `${GRAPH_BASE}/me/drive/${parentPath}/children`;
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: seg,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      }),
    });

    if (!createRes.ok) {
      const errBody = await createRes.text();
      // "nameAlreadyExists" is fine — race condition
      if (!errBody.includes("nameAlreadyExists")) {
        console.error(`Failed to create folder "${currentPath}":`, errBody);
      }
    }
  }
}

/* ── Category → folder name mapping ─────────────────────── */
const CATEGORY_FOLDER_MAP: Record<string, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  sql: "SQL",
  java: "Java",
  "c-c++": "C-CPP",
  "c-cpp": "C-CPP",
  "data-structures": "Data Structures",
  algorithms: "Algorithms",
  "web-dev": "Web Dev",
  devops: "DevOps",
  react: "React",
  go: "Go",
  rust: "Rust",
  swift: "Swift",
  kotlin: "Kotlin",
  ruby: "Ruby",
  php: "PHP",
  other: "Other",
};

function getCategoryFolder(categorySlug: string): string {
  return CATEGORY_FOLDER_MAP[categorySlug] || categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1);
}

/* ── Upload file (small: < 4MB, large: upload session) ── */
export async function uploadToOneDrive(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  categorySlug: string
): Promise<{ url: string; driveItemId: string }> {
  const token = await getAccessToken();
  const categoryFolder = getCategoryFolder(categorySlug);
  const folderPath = `${ROOT_FOLDER}/${categoryFolder}`;

  // Ensure the folder tree exists
  await ensureFolder(folderPath, token);

  // Sanitize filename — replace spaces, keep extension
  const safeName = sanitizeOneDriveFileName(fileName);

  if (fileBuffer.length < 4 * 1024 * 1024) {
    // ── Simple upload (< 4 MB) ────────────────────────
    const uploadUrl = `${GRAPH_BASE}/me/drive/root:/${folderPath}/${safeName}:/content`;
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: new Uint8Array(fileBuffer),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OneDrive simple upload failed:", err);
      throw new Error("OneDrive upload failed");
    }

    const item = await res.json();
    // Return driveItemId — files are served via secure proxy, no sharing links
    return { url: "", driveItemId: item.id };
  } else {
    // ── Upload session (large files) ──────────────────
    const sessionUrl = `${GRAPH_BASE}/me/drive/root:/${folderPath}/${safeName}:/createUploadSession`;
    const sessionRes = await fetch(sessionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        item: { "@microsoft.graph.conflictBehavior": "rename" },
      }),
    });

    if (!sessionRes.ok) {
      throw new Error("Failed to create upload session");
    }

    const { uploadUrl } = await sessionRes.json();

    // Upload in 4MB chunks
    const CHUNK_SIZE = 4 * 1024 * 1024;
    const totalSize = fileBuffer.length;
    let offset = 0;
    let lastResponse: Record<string, unknown> = {};

    while (offset < totalSize) {
      const end = Math.min(offset + CHUNK_SIZE, totalSize);
      const chunk = fileBuffer.subarray(offset, end);

      const chunkRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": `${chunk.length}`,
          "Content-Range": `bytes ${offset}-${end - 1}/${totalSize}`,
        },
        body: new Uint8Array(chunk),
      });

      if (!chunkRes.ok && chunkRes.status !== 202) {
        const err = await chunkRes.text();
        console.error("Chunk upload failed:", err);
        throw new Error("OneDrive chunk upload failed");
      }

      lastResponse = await chunkRes.json();
      offset = end;
    }

    const driveItemId = (lastResponse.id || "") as string;
    return { url: "", driveItemId };
  }
}

/* ── Create a public sharing link ───────────────────────── */
async function createSharingLink(driveItemId: string, token: string): Promise<string> {
  const url = `${GRAPH_BASE}/me/drive/items/${driveItemId}/createLink`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "view",
      scope: "anonymous",
    }),
  });

  if (!res.ok) {
    console.warn("Could not create sharing link, using webUrl fallback");
    // Fallback: get item directly for webUrl
    const itemRes = await fetch(`${GRAPH_BASE}/me/drive/items/${driveItemId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const item = await itemRes.json();
    return item.webUrl || "";
  }

  const data = await res.json();
  return data.link?.webUrl || "";
}

/* ── Upload thumbnail to OneDrive ───────────────────────── */
export async function uploadThumbnailToOneDrive(
  thumbBuffer: Buffer,
  fileName: string,
  categorySlug: string
): Promise<string> {
  const token = await getAccessToken();
  const categoryFolder = getCategoryFolder(categorySlug);
  const folderPath = `${ROOT_FOLDER}/${categoryFolder}/thumbnails`;

  await ensureFolder(folderPath, token);

  const safeName = sanitizeOneDriveFileName(fileName);
  const uploadUrl = `${GRAPH_BASE}/me/drive/root:/${folderPath}/${safeName}:/content`;

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "image/webp",
    },
    body: new Uint8Array(thumbBuffer),
  });

  if (!res.ok) {
    console.warn("Thumbnail upload to OneDrive failed, using local fallback");
    return "";
  }

  const item = await res.json();
  const shareUrl = await createSharingLink(item.id, token);
  return shareUrl;
}

/* ── Upload profile photo to OneDrive ──────────────────── */
export async function uploadProfilePhotoToOneDrive(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<{ driveItemId: string }> {
  const token = await getAccessToken();
  await ensureFolder(USER_PHOTOS_FOLDER, token);

  const safeName = sanitizeOneDriveFileName(fileName);
  const uploadUrl = `${GRAPH_BASE}/me/drive/root:/${USER_PHOTOS_FOLDER}/${safeName}:/content`;

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
    },
    body: new Uint8Array(fileBuffer),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("OneDrive profile photo upload failed:", err);
    throw new Error("OneDrive profile photo upload failed");
  }

  const item = await res.json();
  return { driveItemId: item.id };
}

/* ── Get temporary download URL for a drive item ───────── */
export async function getOneDriveItemDownloadInfo(driveItemId: string): Promise<{
  downloadUrl: string;
  name: string;
  mimeType: string;
}> {
  const token = await getAccessToken();
  const itemRes = await fetch(
    `${GRAPH_BASE}/me/drive/items/${driveItemId}?$select=@microsoft.graph.downloadUrl,name,file`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!itemRes.ok) {
    const err = await itemRes.text();
    throw new Error(`Failed to get OneDrive item: ${err}`);
  }

  const item = await itemRes.json();
  const downloadUrl = item["@microsoft.graph.downloadUrl"] as string | undefined;
  if (!downloadUrl) {
    throw new Error("OneDrive item download URL not available");
  }

  const mimeType = (item.file?.mimeType as string | undefined) || "application/octet-stream";
  const name = (item.name as string | undefined) || "file";

  return { downloadUrl, name, mimeType };
}

/* ── Delete a file from OneDrive by drive item id ──────── */
export async function deleteOneDriveItem(driveItemId: string): Promise<void> {
  if (!driveItemId) return;

  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE}/me/drive/items/${driveItemId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404 || res.status === 204) {
    return;
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to delete OneDrive item: ${err}`);
  }
}

/* ── Check if OneDrive is configured ────────────────────── */
export function isOneDriveConfigured(): boolean {
  return !!(getClientId() && getClientSecret() && getStoredRefreshToken());
}

/* ── Build the OAuth consent URL ────────────────────────── */
export function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: "Files.ReadWrite offline_access",
    response_mode: "query",
  });
  return `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`;
}

/* ── Exchange auth code for tokens ──────────────────────── */
export async function exchangeCodeForTokens(code: string): Promise<void> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    code,
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code",
    scope: "Files.ReadWrite offline_access",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const data = await res.json();
  saveTokenCache({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  });

  cachedAccessToken = data.access_token;
  cachedExpiresAt = Date.now() + data.expires_in * 1000;
}
