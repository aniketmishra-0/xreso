/**
 * POST /api/upload/create-session
 * ────────────────────────────────
 * Creates a OneDrive upload session so the browser can upload
 * files directly to OneDrive, bypassing the Vercel 4.5 MB
 * serverless body‑size limit.
 *
 * Request body (JSON):
 *   { fileName, fileType, fileSize, category }
 *
 * Response (JSON):
 *   { uploadUrl, noteId, folderPath }
 */

import { NextRequest, NextResponse } from "next/server";
import { createOneDriveUploadSession } from "@/lib/onedrive-session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName, fileType, fileSize, category } = body as {
      fileName?: string;
      fileType?: string;
      fileSize?: number;
      category?: string;
    };

    if (!fileName || !fileType || !fileSize || !category) {
      return NextResponse.json(
        { error: "Missing required fields: fileName, fileType, fileSize, category" },
        { status: 400 }
      );
    }

    const MAX_SIZE = 100 * 1024 * 1024; // 100 MB
    if (fileSize > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size: 100 MB" },
        { status: 400 }
      );
    }

    const result = await createOneDriveUploadSession(fileName, category);

    return NextResponse.json({
      uploadUrl: result.uploadUrl,
      folderPath: result.folderPath,
      safeName: result.safeName,
    });
  } catch (error) {
    console.error("POST /api/upload/create-session error:", error);
    const message = error instanceof Error ? error.message : "Failed to create upload session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
