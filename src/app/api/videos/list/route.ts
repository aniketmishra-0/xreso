import { NextRequest, NextResponse } from "next/server";
import { getApprovedVideos, countApprovedVideos } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(24, parseInt(searchParams.get("limit") || "12"));
    const categoryId = searchParams.get("categoryId")
      ? parseInt(searchParams.get("categoryId")!)
      : undefined;
    const searchQuery = searchParams.get("search") || undefined;
    const sortParam = searchParams.get("sort") || "newest";
    const sortBy =
      sortParam === "views" || sortParam === "popular" || sortParam === "saved"
        ? sortParam
        : "newest";

    const offset = (page - 1) * limit;

    // Get videos
    const videos = await getApprovedVideos(
      limit,
      offset,
      categoryId,
      searchQuery,
      sortBy
    );

    // Get total count
    const total = await countApprovedVideos(categoryId);

    return NextResponse.json(
      {
        success: true,
        data: videos,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json(
      { error: "Failed to fetch videos" },
      { status: 500 }
    );
  }
}
