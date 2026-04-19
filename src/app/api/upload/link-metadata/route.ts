import { NextRequest, NextResponse } from "next/server";

const REQUEST_TIMEOUT_MS = 5000;

function isPrivateIpv4Host(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 0) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;

  return false;
}

function isBlockedHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized === "::1"
  ) {
    return true;
  }

  if (isPrivateIpv4Host(normalized)) {
    return true;
  }

  return false;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { url?: unknown };
    const urlValue = typeof body.url === "string" ? body.url.trim() : "";

    if (!urlValue) {
      return jsonError("URL is required", 400);
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlValue);
    } catch {
      return jsonError("Invalid URL", 400);
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return jsonError("Only HTTP(S) URLs are allowed", 400);
    }

    if (isBlockedHost(parsedUrl.hostname)) {
      return jsonError("Host is not allowed", 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const readContentType = (response: Response) =>
        (response.headers.get("content-type") || "")
          .split(";")[0]
          .trim()
          .toLowerCase();

      const headRes = await fetch(parsedUrl.toString(), {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "xreso-link-metadata/1.0",
        },
      });

      let contentType = readContentType(headRes);
      let status = headRes.status;
      let ok = headRes.ok;

      if (!contentType || headRes.status === 405) {
        const getRes = await fetch(parsedUrl.toString(), {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: {
            "User-Agent": "xreso-link-metadata/1.0",
            Range: "bytes=0-0",
          },
        });
        contentType = readContentType(getRes);
        status = getRes.status;
        ok = getRes.ok;
      }

      return NextResponse.json({
        contentType,
        ok,
        status,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return jsonError("Could not fetch URL metadata", 500);
  }
}
