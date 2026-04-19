import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createVideo } from "@/lib/db/queries";
import { appendVideoContentToExcel } from "@/lib/excel";
import { createClient, type Client } from "@libsql/client/web";
import {
  extractVideoId,
  detectVideoType,
  isValidVideoUrl,
  getYouTubeThumbnailUrl,
  type VideoSourceType,
} from "@/lib/video-utils";
import { inspectVideoAccess } from "@/lib/video-access";
import { v4 as uuidv4 } from "uuid";
const MIN_VIDEO_TITLE_LENGTH = 5;

const VIDEO_CATEGORY_ALIASES: Record<string, string> = {
  c: "c-cpp",
  cpp: "c-cpp",
  "c-c++": "c-cpp",
};

const ALLOWED_VIDEO_CATEGORY_SLUGS = new Set([
  "javascript",
  "typescript",
  "python",
  "sql",
  "java",
  "csharp",
  "c",
  "cpp",
  "c-cpp",
  "ruby",
  "php",
  "go",
  "rust",
  "swift",
  "kotlin",
  "bash",
  "html",
  "css",
  "react",
  "data-structures",
  "algorithms",
  "web-dev",
  "other",
]);

function getClient(): Client {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

async function ensureVideosTable(client: Client): Promise<void> {
  await client.execute({
    sql: `
      CREATE TABLE IF NOT EXISTS videos (
        id text PRIMARY KEY NOT NULL,
        title text NOT NULL,
        description text NOT NULL,
        category_id integer NOT NULL,
        author_id text NOT NULL,
        author_credit text NOT NULL,
        video_url text NOT NULL,
        video_type text NOT NULL DEFAULT 'youtube',
        video_id text NOT NULL,
        thumbnail_url text,
        channel_name text,
        channel_url text,
        duration text,
        license_type text NOT NULL DEFAULT 'CC-BY-4.0',
        status text NOT NULL DEFAULT 'pending',
        featured integer NOT NULL DEFAULT 0,
        view_count integer NOT NULL DEFAULT 0,
        created_at text NOT NULL DEFAULT (datetime('now')),
        updated_at text NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (category_id) REFERENCES categories(id),
        FOREIGN KEY (author_id) REFERENCES users(id)
      )
    `,
    args: [],
  });

  await client.execute({
    sql: "CREATE INDEX IF NOT EXISTS videos_status_idx ON videos(status)",
    args: [],
  });

  try {
    await client.execute({
      sql: "ALTER TABLE videos ADD COLUMN channel_name text",
      args: [],
    });
  } catch {
    // Column already exists.
  }

  try {
    await client.execute({
      sql: "ALTER TABLE videos ADD COLUMN channel_url text",
      args: [],
    });
  } catch {
    // Column already exists.
  }
}

function normalizeVideoCategorySlug(input: string) {
  const normalized = input.trim().toLowerCase();
  return VIDEO_CATEGORY_ALIASES[normalized] || normalized;
}

async function resolveCategoryId(client: Client, value: string | number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const byId = await client.execute({
      sql: "SELECT id, slug FROM categories WHERE id = ? LIMIT 1",
      args: [value],
    });
    if (byId.rows.length === 0) return undefined;
    const slug = normalizeVideoCategorySlug(String(byId.rows[0].slug || ""));
    return ALLOWED_VIDEO_CATEGORY_SLUGS.has(slug) ? value : undefined;
  }

  const slugOrName = String(value || "").trim();
  if (!slugOrName) return undefined;
  const normalizedSlug = normalizeVideoCategorySlug(slugOrName);
  if (!ALLOWED_VIDEO_CATEGORY_SLUGS.has(normalizedSlug)) return undefined;

  const result = await client.execute({
    sql: "SELECT id FROM categories WHERE slug = ? LIMIT 1",
    args: [normalizedSlug],
  });

  if (result.rows.length === 0) return undefined;
  return Number(result.rows[0].id);
}

export async function POST(request: NextRequest) {
  try {
    const client = getClient();
    await ensureVideosTable(client);
    const session = await auth();
    const sessionUser = session?.user as
      | { id?: string; name?: string | null; email?: string | null }
      | undefined;

    if (!sessionUser?.id) {
      return NextResponse.json(
        { error: "Please sign in to upload videos." },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      title,
      description,
      categoryId,
      category,
      videoUrl,
      videoSourceType,
      channelName = "",
      channelUrl = "",
      tags = "",
      licenseType = "CC-BY-4.0",
    } = body;

    const normalizedChannelName = String(channelName || "").trim();
    const normalizedChannelUrl = String(channelUrl || "").trim();

    if (normalizedChannelUrl) {
      let parsedChannelUrl: URL;
      try {
        parsedChannelUrl = new URL(normalizedChannelUrl);
      } catch {
        return NextResponse.json(
          { error: "Invalid channel link" },
          { status: 400 }
        );
      }

      if (parsedChannelUrl.protocol !== "http:" && parsedChannelUrl.protocol !== "https:") {
        return NextResponse.json(
          { error: "Channel link must start with http or https" },
          { status: 400 }
        );
      }
    }

    // Validate required fields
    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (title.trim().length < MIN_VIDEO_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `Title must be at least ${MIN_VIDEO_TITLE_LENGTH} characters.` },
        { status: 400 }
      );
    }

    if (!description?.trim()) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    if (!videoUrl?.trim()) {
      return NextResponse.json(
        { error: "Video URL is required" },
        { status: 400 }
      );
    }

    // Validate video URL
    if (!isValidVideoUrl(videoUrl)) {
      return NextResponse.json(
        {
          error:
            "Invalid video URL. Supported: YouTube, Vimeo, Google Drive and OneDrive.",
        },
        { status: 400 }
      );
    }

    // Detect video type
    const videoType = detectVideoType(videoUrl);
    if (!videoType) {
      return NextResponse.json(
        { error: "Could not determine video type" },
        { status: 400 }
      );
    }

    const requestedType = String(videoSourceType || "").trim() as VideoSourceType | "";
    if (requestedType) {
      const isDriveFamily = requestedType === "drive" && (videoType === "drive" || videoType === "onedrive");
      if (!isDriveFamily && requestedType !== videoType) {
        return NextResponse.json(
          { error: `Selected source (${requestedType}) does not match the pasted URL type (${videoType})` },
          { status: 400 }
        );
      }
    }

    // Extract video ID
    const videoId = extractVideoId(videoUrl, videoType);
    if (!videoId) {
      return NextResponse.json(
        { error: "Could not extract video ID from URL" },
        { status: 400 }
      );
    }

    const accessCheck = await inspectVideoAccess(videoUrl);
    if (!accessCheck.isPublic) {
      return NextResponse.json(
        {
          error:
            accessCheck.message ||
            "Video must be public and embeddable before it can be posted.",
        },
        { status: 400 }
      );
    }

    // Generate thumbnail URL
    const thumbnailUrl =
      videoType === "youtube" ? getYouTubeThumbnailUrl(videoId) : "";

    const resolvedCategoryId = await resolveCategoryId(
      client,
      categoryId ?? category
    );
    if (!resolvedCategoryId || Number.isNaN(resolvedCategoryId)) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 400 }
      );
    }

    const authorId = sessionUser.id;

    // Create video record
    const videoRecord = {
      id: uuidv4(),
      title: title.trim(),
      description: description.trim(),
      categoryId: Number(resolvedCategoryId),
      authorId,
      authorCredit: sessionUser.name?.trim() || "Xreso Member",
      videoUrl,
      videoType,
      videoId,
      thumbnailUrl: thumbnailUrl || "",
      channelName: normalizedChannelName,
      channelUrl: normalizedChannelUrl,
      licenseType,
    };

    const success = await createVideo(videoRecord);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to create video" },
        { status: 500 }
      );
    }

    try {
      await appendVideoContentToExcel({
        noteId: videoRecord.id,
        title: videoRecord.title,
        description: videoRecord.description,
        category: String(category || "other"),
        link: videoRecord.videoUrl,
        author: videoRecord.authorCredit,
        authorEmail: sessionUser?.email || "",
        tags: typeof tags === "string" ? tags : "",
        license: videoRecord.licenseType,
        status: "approved",
      });
    } catch {
      // Non-fatal: video creation should succeed even if Excel sync fails.
    }

    return NextResponse.json(
      {
        success: true,
        message: "Video link saved successfully",
        videoId: videoRecord.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating video:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
