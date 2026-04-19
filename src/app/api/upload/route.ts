import { after, NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isOneDriveConfigured, uploadToOneDrive } from "@/lib/onedrive";
import { appendLinkToExcel } from "@/lib/excel";
import { createClient, Client } from "@libsql/client/web";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import os from "os";

export const maxDuration = 300;

function getClient(): Client {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("TURSO_DATABASE_URL is not configured");
  }

  return createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "");
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const column = columnName.toLowerCase();
  return (
    message.includes(`no such column: ${column}`) ||
    message.includes(`has no column named ${column}`) ||
    message.includes(`unknown column: ${column}`) ||
    message.includes(`unknown field: ${column}`)
  );
}

function isDuplicateColumnError(error: unknown, columnName: string): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const column = columnName.toLowerCase();
  return message.includes(`duplicate column name: ${column}`);
}

function isStorageConfigError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("turso_database_url is not configured");
}

let ensureDriveColumnPromise: Promise<void> | null = null;
const ONE_DRIVE_UPLOAD_MAX_ATTEMPTS = 4;
const ANONYMOUS_USER_ID = "anonymous-uploader";
const ANONYMOUS_USER_EMAIL = "anonymous@xreso.local";
const ANONYMOUS_USER_NAME = "Anonymous";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDriveItemColumn(client: Client): Promise<void> {
  if (ensureDriveColumnPromise) {
    await ensureDriveColumnPromise;
    return;
  }

  ensureDriveColumnPromise = (async () => {
    try {
      await client.execute({
        sql: "ALTER TABLE notes ADD COLUMN drive_item_id TEXT",
        args: []
      });
      console.log("[Upload] Added notes.drive_item_id column for OneDrive sync.");
    } catch (error) {
      if (isDuplicateColumnError(error, "drive_item_id")) {
        return;
      }
      // Keep request path resilient even if migration isn't allowed.
      console.warn(
        "[Upload] Could not auto-migrate notes.drive_item_id. Falling back to compatibility mode.",
        error
      );
    }
  })();

  await ensureDriveColumnPromise;
}

// Ensure local temporary upload directory exists (Vercel compatible)
const UPLOAD_DIR = path.join(os.tmpdir(), "xreso_uploads");
function ensureDir(targetDir: string) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
}

function getImageMimeTypeFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".png")) return "image/png";
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
    if (pathname.endsWith(".webp")) return "image/webp";
    if (pathname.endsWith(".gif")) return "image/gif";
    if (pathname.endsWith(".avif")) return "image/avif";
  } catch {
    return null;
  }

  return null;
}

async function isAutoApproveEnabled(client: Client): Promise<boolean> {
  try {
    const result = await client.execute({
      sql: "SELECT value FROM settings WHERE key = 'auto_approve_enabled'",
      args: [],
    });
    // Case-insensitive check for true/1/yes
    if (result.rows.length === 0) return false;
    const value = String(result.rows[0].value).toLowerCase().trim();
    return value === "true" || value === "1" || value === "yes";
  } catch {
    // settings table may not exist yet
    return false;
  }
}

const CATEGORY_ALIASES: Record<string, string> = {
  c: "c-cpp",
  cpp: "c-cpp",
  "c-c++": "c-cpp",
};

const CATEGORY_NAMES: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  sql: "SQL",
  java: "Java",
  csharp: "C#",
  c: "C",
  cpp: "C++",
  "c-cpp": "C / C++",
  ruby: "Ruby",
  php: "PHP",
  go: "Go",
  rust: "Rust",
  swift: "Swift",
  kotlin: "Kotlin",
  bash: "Bash",
  html: "HTML",
  css: "CSS",
  react: "React",
  "data-structures": "Data Structures",
  algorithms: "Algorithms",
  "web-dev": "Web Dev",
  other: "Other",
};

function normalizeCategorySlug(slug: string): string {
  return CATEGORY_ALIASES[slug] || slug;
}

async function resolveCategoryId(client: Client, rawSlug: string): Promise<number | undefined> {
  const slug = normalizeCategorySlug(rawSlug);

  const existingRes = await client.execute({ sql: "SELECT id FROM categories WHERE slug = ?", args: [slug] });
  if (existingRes.rows.length > 0) return existingRes.rows[0].id as number;

  const categoryName = CATEGORY_NAMES[slug];
  if (!categoryName) return undefined;

  await client.execute({
    sql: "INSERT OR IGNORE INTO categories (name, slug, description, note_count) VALUES (?, ?, ?, 0)",
    args: [categoryName, slug, `${categoryName} programming notes`]
  });

  const createdRes = await client.execute({ sql: "SELECT id FROM categories WHERE slug = ?", args: [slug] });
  return createdRes.rows.length > 0 ? (createdRes.rows[0].id as number) : undefined;
}

async function createLocalThumbnail(noteId: string, fileName: string, fileBuffer: Buffer, fileType: string) {
  if (!fileType.startsWith("image/")) return "";

  try {
    const sharp = (await import("sharp")).default;
    const THUMB_DIR = path.join(UPLOAD_DIR, "thumbs");
    ensureDir(THUMB_DIR);
    const thumbName = `thumb_${noteId}.webp`;
    const thumbPath = path.join(THUMB_DIR, thumbName);

    await sharp(fileBuffer).resize(400, 300, { fit: "cover" }).webp({ quality: 80 }).toFile(thumbPath);
    return `/api/files/${noteId}?action=thumb`; // Use proxy route
  } catch (error) {
    console.warn("Thumbnail generation failed, using original file:", error);
    return `/api/files/${noteId}`;
  }
}

async function uploadToOneDriveWithRetry(params: {
  fileBuffer: Buffer;
  fileName: string;
  fileType: string;
  category: string;
  sourceLabel: string;
}) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= ONE_DRIVE_UPLOAD_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await uploadToOneDrive(
        params.fileBuffer,
        params.fileName,
        params.fileType,
        params.category
      );
    } catch (error) {
      lastError = error;
      if (attempt >= ONE_DRIVE_UPLOAD_MAX_ATTEMPTS) break;

      const backoffMs = Math.min(1200 * 2 ** (attempt - 1), 12_000);
      const jitterMs = Math.floor(Math.random() * 450);
      const waitMs = backoffMs + jitterMs;
      console.warn(
        `[Upload] OneDrive ${params.sourceLabel} retry ${attempt}/${ONE_DRIVE_UPLOAD_MAX_ATTEMPTS} in ${waitMs}ms:`,
        error
      );
      await wait(waitMs);
    }
  }

  throw lastError;
}

function syncNoteToOneDriveInBackground(params: { noteId: string; fileBuffer: Buffer; fileName: string; fileType: string; category: string; }) {
  after(async () => {
    try {
      const uploaded = await uploadToOneDriveWithRetry({
        fileBuffer: params.fileBuffer,
        fileName: params.fileName,
        fileType: params.fileType,
        category: params.category,
        sourceLabel: "background sync",
      });
      const client = getClient();
      await updateNoteDriveItemId(client, params.noteId, uploaded.driveItemId);
      console.log(`[Upload] Background OneDrive sync complete for note ${params.noteId}`);
    } catch (error) {
      console.error(`[Upload] Background OneDrive sync failed for note ${params.noteId}:`, error);
    }
  });
}

async function ensureUserRecord(client: Client, sessionUser: { id?: string; email?: string | null; name?: string | null }) {
  if (!sessionUser.id) return null;

  const existingUserRes = await client.execute({ sql: "SELECT id FROM users WHERE id = ?", args: [sessionUser.id] });
  if (existingUserRes.rows.length > 0) return sessionUser.id;

  const email = sessionUser.email || "";
  const emailUserRes = await client.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [email] });
  if (emailUserRes.rows.length > 0) {
    sessionUser.id = emailUserRes.rows[0].id as string;
    return sessionUser.id;
  }

  await client.execute({
    sql: "INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)",
    args: [sessionUser.id, sessionUser.name || "User", email, "user"]
  });

  return sessionUser.id;
}

async function ensureAnonymousUserRecord(client: Client): Promise<string> {
  const byId = await client.execute({
    sql: "SELECT id FROM users WHERE id = ?",
    args: [ANONYMOUS_USER_ID],
  });
  if (byId.rows.length > 0) return ANONYMOUS_USER_ID;

  const byEmail = await client.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: [ANONYMOUS_USER_EMAIL],
  });
  if (byEmail.rows.length > 0) return String(byEmail.rows[0].id);

  await client.execute({
    sql: "INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)",
    args: [ANONYMOUS_USER_ID, ANONYMOUS_USER_NAME, ANONYMOUS_USER_EMAIL, "user"],
  });

  return ANONYMOUS_USER_ID;
}

async function resolveAuthorId(
  client: Client,
  sessionUser?: { id?: string; email?: string | null; name?: string | null } | null
): Promise<string> {
  if (sessionUser?.id) {
    const userId = await ensureUserRecord(client, sessionUser);
    if (userId) return userId;
  }

  return ensureAnonymousUserRecord(client);
}

async function insertUploadedFileNote(
  client: Client,
  data: {
    noteId: string;
    title: string;
    description: string;
    categoryId: number;
    authorId: string;
    authorCredit: string;
    thumbnailUrl: string;
    fileUrl: string;
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
    sourceUrl: string | null;
    licenseType: string;
    status: string;
  }
) {
  try {
    await client.execute({
      sql: `INSERT INTO notes (id, title, description, category_id, author_id, author_credit, thumbnail_url, file_url, file_name, file_type, file_size_bytes, source_url, license_type, status, drive_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        data.noteId,
        data.title,
        data.description,
        data.categoryId,
        data.authorId,
        data.authorCredit,
        data.thumbnailUrl,
        data.fileUrl,
        data.fileName,
        data.fileType,
        data.fileSizeBytes,
        data.sourceUrl,
        data.licenseType,
        data.status,
        null
      ]
    });
    return;
  } catch (error) {
    if (!isMissingColumnError(error, "drive_item_id")) {
      throw error;
    }
    console.warn(
      "[Upload] notes.drive_item_id column not found. Falling back to legacy notes insert."
    );
  }

  await client.execute({
    sql: `INSERT INTO notes (id, title, description, category_id, author_id, author_credit, thumbnail_url, file_url, file_name, file_type, file_size_bytes, source_url, license_type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.noteId,
      data.title,
      data.description,
      data.categoryId,
      data.authorId,
      data.authorCredit,
      data.thumbnailUrl,
      data.fileUrl,
      data.fileName,
      data.fileType,
      data.fileSizeBytes,
      data.sourceUrl,
      data.licenseType,
      data.status
    ]
  });
}

async function updateNoteDriveItemId(client: Client, noteId: string, driveItemId: string) {
  try {
    await client.execute({
      sql: "UPDATE notes SET drive_item_id = ?, updated_at = datetime('now') WHERE id = ?",
      args: [driveItemId, noteId]
    });
  } catch (error) {
    if (isMissingColumnError(error, "drive_item_id")) {
      console.warn(
        "[Upload] Skipping drive_item_id update because notes.drive_item_id is missing."
      );
      return;
    }
    throw error;
  }
}

export async function POST(req: NextRequest) {
  let uploadedLocalFilePath: string | null = null;

  try {
    const client = getClient();
    await ensureDriveItemColumn(client);
    const session = await auth();
    const sessionUser = session?.user;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const category = formData.get("category") as string;
    const tags = formData.get("tags") as string;
    const authorCredit = formData.get("authorCredit") as string;
    const sourceUrl = formData.get("sourceUrl") as string;
    const resourceUrl = formData.get("resourceUrl") as string;
    const licenseType = formData.get("licenseType") as string;
    const uploadMode = formData.get("uploadMode") as string;

    const autoApprove = await isAutoApproveEnabled(client);
    const initialStatus = autoApprove ? "approved" : "pending";
    const normalizedAuthorCredit = (authorCredit || sessionUser?.name || ANONYMOUS_USER_NAME).trim() || ANONYMOUS_USER_NAME;
    const authorId = await resolveAuthorId(client, sessionUser);

    if (uploadMode === "link") {
      if (!title || !description || !category || !resourceUrl) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const noteId = uuidv4();

      const categoryId = await resolveCategoryId(client, category);
      if (!categoryId) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

      const imageMimeType = getImageMimeTypeFromUrl(resourceUrl);

      await client.execute({
        sql: `INSERT INTO notes (id, title, description, category_id, author_id, author_credit, thumbnail_url, file_url, file_name, file_type, file_size_bytes, source_url, license_type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          noteId,
          title,
          description,
          categoryId,
          authorId,
          normalizedAuthorCredit,
          imageMimeType ? resourceUrl : "",
          resourceUrl,
          "",
          imageMimeType || "link",
          0,
          resourceUrl,
          licenseType || "CC-BY-4.0",
          initialStatus,
        ]
      });

      if (autoApprove) {
        await client.execute(`UPDATE categories SET note_count = (SELECT COUNT(*) FROM notes WHERE notes.category_id = categories.id AND notes.status = 'approved')`);
      }

      if (tags) await insertTags(client, noteId, tags);

      try {
        await appendLinkToExcel({
          noteId, title, description, category,
          link: resourceUrl, author: sessionUser?.name || normalizedAuthorCredit,
          authorEmail: sessionUser?.email || "", tags: tags || "", license: licenseType || "CC-BY-4.0",
        });
      } catch (error) {
        console.error("[Excel] append failed:", error);
      }

      return NextResponse.json({ success: true, noteId, message: "Resource shared successfully!" });
    }

    if (!file || !title || !description || !category) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Allowed: PNG, JPG, WEBP, PDF" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum size: 10MB" }, { status: 400 });
    }

    const noteId = uuidv4();
    // Security: Use path.extname to prevent path traversal attacks
    const ext = path.extname(file.name).slice(1).toLowerCase() || "png";
    // Validate extension is alphanumeric only (prevent injection)
    const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "bin";
    const fileName = `${noteId}.${safeExt}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    ensureDir(UPLOAD_DIR);
    const filePath = path.join(UPLOAD_DIR, fileName);
    fs.writeFileSync(filePath, fileBuffer);
    uploadedLocalFilePath = filePath;

    const fileUrl = `/api/files/${noteId}`; // Do not rely on local /uploads/ URL
    const thumbnailUrl = (await createLocalThumbnail(noteId, fileName, fileBuffer, file.type)) || fileUrl;

    const categoryId = await resolveCategoryId(client, category);
    if (!categoryId) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

    await insertUploadedFileNote(client, {
      noteId,
      title,
      description,
      categoryId,
      authorId,
      authorCredit: normalizedAuthorCredit,
      thumbnailUrl,
      fileUrl,
      fileName: file.name,
      fileType: file.type,
      fileSizeBytes: file.size,
      sourceUrl: sourceUrl || null,
      licenseType: licenseType || "CC-BY-4.0",
      status: initialStatus,
    });

    if (tags) await insertTags(client, noteId, tags);

    if (autoApprove) {
      await client.execute(`UPDATE categories SET note_count = (SELECT COUNT(*) FROM notes WHERE notes.category_id = categories.id AND notes.status = 'approved')`);
    }

    const stableFileUrl = `${req.nextUrl.origin}/api/files/${noteId}`;
    try {
      await appendLinkToExcel({ noteId, title, description, category, link: stableFileUrl, author: sessionUser?.name || normalizedAuthorCredit, authorEmail: sessionUser?.email || "", tags: tags || "", license: licenseType || "CC-BY-4.0" });
    } catch (error) {
      console.error("[Excel] append failed for file upload:", error);
    }

    const oneDriveEnabled = isOneDriveConfigured();
    let storageMode: "local" | "onedrive" | "onedrive-pending-sync" = "local";
    let uploadMessage = autoApprove
      ? "Note uploaded and approved successfully!"
      : "Note uploaded successfully! It will be reviewed before publishing.";

    if (oneDriveEnabled) {
      try {
        const uploaded = await uploadToOneDriveWithRetry({
          fileBuffer,
          fileName,
          fileType: file.type,
          category,
          sourceLabel: "foreground upload",
        });
        await updateNoteDriveItemId(client, noteId, uploaded.driveItemId);
        storageMode = "onedrive";
      } catch (oneDriveError) {
        console.error(
          `[Upload] Foreground OneDrive upload failed for note ${noteId}, queued for background retry:`,
          oneDriveError
        );
        syncNoteToOneDriveInBackground({
          noteId,
          fileBuffer,
          fileName,
          fileType: file.type,
          category,
        });
        storageMode = "onedrive-pending-sync";
        uploadMessage =
          "Note uploaded successfully. OneDrive sync is delayed and will retry automatically.";
      }
    }

    return NextResponse.json({
      success: true,
      noteId,
      storage: storageMode,
      message: uploadMessage,
    });
  } catch (error) {
    // Security: Log detailed error server-side only, return generic message to client
    console.error("POST /api/upload error:", error);
    
    // Secure cleanup of temp files
    if (uploadedLocalFilePath) {
      try {
        if (fs.existsSync(uploadedLocalFilePath)) {
          fs.unlinkSync(uploadedLocalFilePath);
        }
      } catch (cleanupError) {
        console.error("Failed to cleanup temp file:", cleanupError);
      }
    }
    
    // Don't expose internal error details to client
    if (isStorageConfigError(error)) {
      return NextResponse.json(
        { error: "Upload service is not configured. Please contact support." },
        { status: 503 }
      );
    }
    
    // Generic error message for security
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}

async function insertTags(client: Client, noteId: string, tags: string) {
  const tagList = tags.split(",").map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean);
  for (const tagSlug of tagList) {
    await client.execute({ sql: "INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)", args: [tagSlug, tagSlug] });
    const tagRes = await client.execute({ sql: "SELECT id FROM tags WHERE slug = ?", args: [tagSlug] });
    if (tagRes.rows.length > 0) {
      await client.execute({ sql: "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)", args: [noteId, tagRes.rows[0].id as number] });
    }
  }
}
