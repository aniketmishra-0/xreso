/**
 * OneDrive Upload Session Helper
 * ────────────────────────────────
 * Creates a resumable upload session for direct browser→OneDrive uploads.
 * Exported from a separate module so the main onedrive.ts stays untouched.
 */

import fs from "fs";
import path from "path";

const TOKEN_CACHE_PATH = path.join(process.cwd(), ".onedrive-token.json");
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TENANT_ID = process.env.ONEDRIVE_TENANT_ID || "common";
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
const ROOT_FOLDER = "Xreso";

/* ── Env helpers ──────────────────────────────── */
function getClientId() {
  return process.env.ONEDRIVE_CLIENT_ID || "";
}
function getClientSecret() {
  return process.env.ONEDRIVE_CLIENT_SECRET || "";
}

let cachedAccessToken = "";
let cachedExpiresAt = 0;
let cachedRefreshToken = "";

function getStoredRefreshToken(): string {
  if (cachedRefreshToken) return cachedRefreshToken;
  if (process.env.ONEDRIVE_REFRESH_TOKEN) return process.env.ONEDRIVE_REFRESH_TOKEN;
  try {
    const raw = fs.readFileSync(TOKEN_CACHE_PATH, "utf-8");
    const data = JSON.parse(raw);
    return data.refresh_token || "";
  } catch {
    return "";
  }
}

function saveTokenCache(data: { access_token: string; refresh_token: string; expires_at: number }) {
  try {
    fs.writeFileSync(TOKEN_CACHE_PATH, JSON.stringify(data, null, 2));
  } catch {
    // Read-only FS on Vercel is fine
  }
}

async function getAccessToken(): Promise<string> {
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

  if (data.refresh_token) {
    cachedRefreshToken = data.refresh_token;
    saveTokenCache({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: cachedExpiresAt,
    });
  }

  return cachedAccessToken;
}

/* ── Category → folder name ───────────────────── */
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
  return (
    CATEGORY_FOLDER_MAP[categorySlug] ||
    categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1)
  );
}

function sanitizeOneDriveFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/* ── Ensure folder tree exists ────────────────── */
async function ensureFolder(folderPath: string, token: string): Promise<void> {
  const segments = folderPath.split("/");
  let currentPath = "";

  for (const seg of segments) {
    const parentPath = currentPath ? `root:/${currentPath}:` : "root";
    currentPath = currentPath ? `${currentPath}/${seg}` : seg;

    const checkUrl = `${GRAPH_BASE}/me/drive/root:/${currentPath}`;
    const check = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (check.ok) continue;

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
      if (!errBody.includes("nameAlreadyExists")) {
        console.error(`Failed to create folder "${currentPath}":`, errBody);
      }
    }
  }
}

/* ── Create an upload session ─────────────────── */
export async function createOneDriveUploadSession(
  fileName: string,
  categorySlug: string
): Promise<{ uploadUrl: string; folderPath: string; safeName: string }> {
  const token = await getAccessToken();
  const categoryFolder = getCategoryFolder(categorySlug);
  const folderPath = `${ROOT_FOLDER}/${categoryFolder}`;

  await ensureFolder(folderPath, token);

  const safeName = sanitizeOneDriveFileName(fileName);
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
    const err = await sessionRes.text();
    console.error("OneDrive createUploadSession failed:", err);
    throw new Error("Failed to create OneDrive upload session");
  }

  const data = await sessionRes.json();

  return {
    uploadUrl: data.uploadUrl,
    folderPath,
    safeName,
  };
}
