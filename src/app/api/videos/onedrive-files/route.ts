import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs";
import path from "path";

const TOKEN_CACHE_PATH = path.join(process.cwd(), ".onedrive-token.json");
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TENANT_ID = process.env.ONEDRIVE_TENANT_ID || "common";
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
const ROOT_FOLDER = "Xreso";

let cachedAccessToken = "";
let cachedExpiresAt = 0;
let cachedRefreshToken = "";

function getClientId() {
  return process.env.ONEDRIVE_CLIENT_ID || "";
}

function getClientSecret() {
  return process.env.ONEDRIVE_CLIENT_SECRET || "";
}

function getStoredRefreshToken(): string {
  if (cachedRefreshToken) return cachedRefreshToken;
  if (process.env.ONEDRIVE_REFRESH_TOKEN) return process.env.ONEDRIVE_REFRESH_TOKEN;

  try {
    const raw = fs.readFileSync(TOKEN_CACHE_PATH, "utf-8");
    const data = JSON.parse(raw) as { refresh_token?: string };
    return data.refresh_token || "";
  } catch {
    return "";
  }
}

function saveTokenCache(data: {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}) {
  try {
    fs.writeFileSync(TOKEN_CACHE_PATH, JSON.stringify(data, null, 2));
  } catch {
    // Ignore read-only FS errors.
  }
}

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    throw new Error("OneDrive is not configured");
  }

  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: "Files.ReadWrite offline_access",
  });

  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to refresh OneDrive access token");
  }

  const tokenPayload = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  cachedAccessToken = tokenPayload.access_token;
  cachedExpiresAt = Date.now() + tokenPayload.expires_in * 1000;

  if (tokenPayload.refresh_token) {
    cachedRefreshToken = tokenPayload.refresh_token;
    saveTokenCache({
      access_token: tokenPayload.access_token,
      refresh_token: tokenPayload.refresh_token,
      expires_at: cachedExpiresAt,
    });
  }

  return cachedAccessToken;
}

interface GraphDriveItem {
  id: string;
  name: string;
  webUrl?: string;
  size?: number;
  lastModifiedDateTime?: string;
  folder?: Record<string, unknown>;
  file?: { mimeType?: string };
}

async function listChildren(
  token: string,
  endpoint: string
): Promise<GraphDriveItem[]> {
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return [];

  const payload = (await response.json()) as { value?: GraphDriveItem[] };
  return payload.value || [];
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Please sign in to browse OneDrive files" }, { status: 401 });
    }

    const token = await getAccessToken();
    const rootEndpoint = `${GRAPH_BASE}/me/drive/root:/${ROOT_FOLDER}:/children?$top=200&$select=id,name,webUrl,size,lastModifiedDateTime,file,folder`;

    const rootItems = await listChildren(token, rootEndpoint);

    const folderItems = rootItems.filter((item) => Boolean(item.folder));
    const directVideoItems = rootItems.filter(
      (item) => item.file?.mimeType?.startsWith("video/")
    );

    const nestedItemsBatches = await Promise.all(
      folderItems.map((folder) =>
        listChildren(
          token,
          `${GRAPH_BASE}/me/drive/items/${encodeURIComponent(folder.id)}/children?$top=200&$select=id,name,webUrl,size,lastModifiedDateTime,file,folder`
        ).then((children) => ({ folderName: folder.name, children }))
      )
    );

    const nestedVideoItems = nestedItemsBatches.flatMap(({ folderName, children }) =>
      children
        .filter((item) => item.file?.mimeType?.startsWith("video/"))
        .map((item) => ({
          ...item,
          name: `${folderName}/${item.name}`,
        }))
    );

    const items = [...directVideoItems, ...nestedVideoItems]
      .slice(0, 150)
      .map((item) => ({
        id: item.id,
        name: item.name,
        webUrl: item.webUrl || "",
        size: Number(item.size || 0),
        mimeType: item.file?.mimeType || "video/mp4",
        updatedAt: item.lastModifiedDateTime || "",
        streamUrl: `/api/videos/onedrive-stream?itemId=${encodeURIComponent(item.id)}`,
      }));

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error("GET /api/videos/onedrive-files error:", error);
    return NextResponse.json(
      { error: "Failed to browse OneDrive videos" },
      { status: 500 }
    );
  }
}
