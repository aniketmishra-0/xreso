import { NextRequest, NextResponse } from "next/server";
import { getVideoById, incrementVideoViewCount } from "@/lib/db/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Video ID is required" },
        { status: 400 }
      );
    }

    // Get video
    const video = await getVideoById(id);

    if (!video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    // Check if video is approved
    if (video.status !== "approved") {
      return NextResponse.json(
        { error: "This video is not available" },
        { status: 404 }
      );
    }

    // Increment view count asynchronously
    incrementVideoViewCount(id);

    return NextResponse.json(
      {
        success: true,
        data: video,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching video:", error);
    return NextResponse.json(
      { error: "Failed to fetch video" },
      { status: 500 }
    );
  }
}
