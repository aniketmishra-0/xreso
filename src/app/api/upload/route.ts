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
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!
  });
}

// Ensure local temporary upload directory exists (Vercel compatible)
const UPLOAD_DIR = path.join(os.tmpdir(), "xreso_uploads");
function ensureDir(targetDir: string) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
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

function syncNoteToOneDriveInBackground(params: { noteId: string; fileBuffer: Buffer; fileName: string; fileType: string; category: string; }) {
  after(async () => {
    try {
      const uploaded = await uploadToOneDrive(params.fileBuffer, params.fileName, params.fileType, params.category);
      const client = getClient();
      await client.execute({
        sql: "UPDATE notes SET drive_item_id = ?, updated_at = datetime('now') WHERE id = ?",
        args: [uploaded.driveItemId, params.noteId]
      });
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

export async function POST(req: NextRequest) {
  let uploadedLocalFilePath: string | null = null;
  const client = getClient();

  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    if (uploadMode === "link") {
      if (!title || !description || !category || !authorCredit || !resourceUrl) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const noteId = uuidv4();
      const authorId = await ensureUserRecord(client, session.user);
      if (!authorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const categoryId = await resolveCategoryId(client, category);
      if (!categoryId) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

      await client.execute({
        sql: `INSERT INTO notes (id, title, description, category_id, author_id, author_credit, thumbnail_url, file_url, file_name, file_type, file_size_bytes, source_url, license_type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [noteId, title, description, categoryId, authorId, authorCredit, "", resourceUrl, "", "link", 0, resourceUrl, licenseType || "CC-BY-4.0", "pending"]
      });

      if (tags) await insertTags(client, noteId, tags);

      try {
        await appendLinkToExcel({
          noteId, title, description, category,
          link: resourceUrl, author: session.user.name || authorCredit,
          authorEmail: session.user.email || "", tags: tags || "", license: licenseType || "CC-BY-4.0",
        });
      } catch (error) {
        console.error("[Excel] append failed:", error);
      }

      return NextResponse.json({ success: true, noteId, message: "Resource shared successfully!" });
    }

    if (!file || !title || !description || !category || !authorCredit) {
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
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const fileName = `${noteId}.${ext}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    ensureDir(UPLOAD_DIR);
    const filePath = path.join(UPLOAD_DIR, fileName);
    fs.writeFileSync(filePath, fileBuffer);
    uploadedLocalFilePath = filePath;

    const fileUrl = `/api/files/${noteId}`; // Do not rely on local /uploads/ URL
    const thumbnailUrl = (await createLocalThumbnail(noteId, fileName, fileBuffer, file.type)) || fileUrl;

    const authorId = await ensureUserRecord(client, session.user);
    if (!authorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const categoryId = await resolveCategoryId(client, category);
    if (!categoryId) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

    await client.execute({
      sql: `INSERT INTO notes (id, title, description, category_id, author_id, author_credit, thumbnail_url, file_url, file_name, file_type, file_size_bytes, source_url, license_type, status, drive_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [noteId, title, description, categoryId, authorId, authorCredit, thumbnailUrl, fileUrl, file.name, file.type, file.size, sourceUrl || null, licenseType || "CC-BY-4.0", "pending", null]
    });

    if (tags) await insertTags(client, noteId, tags);

    const stableFileUrl = `${req.nextUrl.origin}/api/files/${noteId}`;
    try {
      await appendLinkToExcel({ noteId, title, description, category, link: stableFileUrl, author: session.user.name || authorCredit, authorEmail: session.user.email || "", tags: tags || "", license: licenseType || "CC-BY-4.0" });
    } catch (error) {
      console.error("[Excel] append failed for file upload:", error);
    }

    const oneDriveEnabled = isOneDriveConfigured();
    if (oneDriveEnabled) {
      syncNoteToOneDriveInBackground({ noteId, fileBuffer, fileName, fileType: file.type, category });
    }

    return NextResponse.json({
      success: true,
      noteId,
      storage: oneDriveEnabled ? "OneDrive + local fallback" : "local",
      message: "Note uploaded successfully! It will be reviewed before publishing.",
    });
  } catch (error) {
    console.error("POST /api/upload error:", error);
    if (uploadedLocalFilePath && fs.existsSync(uploadedLocalFilePath)) {
      try { fs.unlinkSync(uploadedLocalFilePath); } catch {}
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
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
