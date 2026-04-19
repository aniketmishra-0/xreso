import { NextRequest, NextResponse } from "next/server";
import { inspectVideoAccess } from "@/lib/video-access";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: unknown };
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const result = await inspectVideoAccess(url);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("POST /api/videos/public-check error:", error);
    return NextResponse.json(
      { error: "Could not verify video visibility" },
      { status: 500 }
    );
  }
}
