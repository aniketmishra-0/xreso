import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const TOKEN_CACHE_PATH = path.join(process.cwd(), ".onedrive-token.json");
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TENANT_ID = process.env.ONEDRIVE_TENANT_ID || "common";
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

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
    // Local cache write may fail on read-only FS (expected in some environments).
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

export async function GET(request: NextRequest) {
  try {
    const itemId = request.nextUrl.searchParams.get("itemId") || "";
    if (!itemId || !/^[a-zA-Z0-9!._-]+$/.test(itemId)) {
      return NextResponse.json({ error: "Valid itemId is required" }, { status: 400 });
    }

    const token = await getAccessToken();
    const contentUrl = `${GRAPH_BASE}/me/drive/items/${encodeURIComponent(itemId)}/content`;

    const upstreamResponse = await fetch(contentUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(request.headers.get("range")
          ? { Range: request.headers.get("range") as string }
          : {}),
      },
      redirect: "follow",
    });

    if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
      const upstreamError = await upstreamResponse.text();
      return NextResponse.json(
        {
          error: "Failed to stream OneDrive file",
          details: upstreamError.slice(0, 240),
        },
        { status: upstreamResponse.status || 502 }
      );
    }

    const headers = new Headers();
    const passthroughHeaders = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
      "etag",
      "last-modified",
      "content-disposition",
    ];

    for (const headerName of passthroughHeaders) {
      const value = upstreamResponse.headers.get(headerName);
      if (value) headers.set(headerName, value);
    }

    if (!headers.get("cache-control")) {
      headers.set("cache-control", "public, max-age=60");
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers,
    });
  } catch (error) {
    console.error("GET /api/videos/onedrive-stream error:", error);
    return NextResponse.json(
      { error: "Unable to stream OneDrive video right now" },
      { status: 500 }
    );
  }
}
