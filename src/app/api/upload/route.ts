import { after, NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isOneDriveConfigured, uploadToOneDrive } from "@/lib/onedrive";
import { appendLinkToExcel } from "@/lib/excel";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

export const maxDuration = 300;

const DB_PATH = path.join(process.cwd(), "xreso.db");
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const THUMB_DIR = path.join(UPLOAD_DIR, "thumbs");

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

function resolveCategoryId(sqlite: Database.Database, rawSlug: string): number | undefined {
  const slug = normalizeCategorySlug(rawSlug);

  const existing = sqlite
    .prepare("SELECT id FROM categories WHERE slug = ?")
    .get(slug) as { id: number } | undefined;

  if (existing) {
    return existing.id;
  }

  const categoryName = CATEGORY_NAMES[slug];
  if (!categoryName) {
    return undefined;
  }

  sqlite
    .prepare("INSERT OR IGNORE INTO categories (name, slug, description, note_count) VALUES (?, ?, ?, 0)")
    .run(categoryName, slug, `${categoryName} programming notes`);

  const created = sqlite
    .prepare("SELECT id FROM categories WHERE slug = ?")
    .get(slug) as { id: number } | undefined;

  return created?.id;
}

function ensureDir(targetDir: string) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
}

async function createLocalThumbnail(
  noteId: string,
  fileName: string,
  fileBuffer: Buffer,
  fileType: string
) {
  if (!fileType.startsWith("image/")) {
    return "";
  }

  try {
    const sharp = (await import("sharp")).default;
    ensureDir(THUMB_DIR);
    const thumbName = `thumb_${noteId}.webp`;
    const thumbPath = path.join(THUMB_DIR, thumbName);

    await sharp(fileBuffer)
      .resize(400, 300, { fit: "cover" })
      .webp({ quality: 80 })
      .toFile(thumbPath);

    return `/uploads/thumbs/${thumbName}`;
  } catch (error) {
    console.warn("Thumbnail generation failed, using original file:", error);
    return `/uploads/${fileName}`;
  }
}

function syncNoteToOneDriveInBackground(params: {
  noteId: string;
  fileBuffer: Buffer;
  fileName: string;
  fileType: string;
  category: string;
}) {
  after(async () => {
    try {
      const uploaded = await uploadToOneDrive(
        params.fileBuffer,
        params.fileName,
        params.fileType,
        params.category
      );

      const sqlite = new Database(DB_PATH);
      try {
        sqlite
          .prepare(
            "UPDATE notes SET drive_item_id = ?, updated_at = datetime('now') WHERE id = ?"
          )
          .run(uploaded.driveItemId, params.noteId);
      } finally {
        sqlite.close();
      }

      console.log(
        `[Upload] Background OneDrive sync complete for note ${params.noteId}`
      );
    } catch (error) {
      console.error(
        `[Upload] Background OneDrive sync failed for note ${params.noteId}:`,
        error
      );
    }
  });
}

function ensureUserRecord(
  sqlite: Database.Database,
  sessionUser: { id?: string; email?: string | null; name?: string | null }
) {
  if (!sessionUser.id) {
    return null;
  }

  const existingUser = sqlite
    .prepare("SELECT id FROM users WHERE id = ?")
    .get(sessionUser.id);

  if (existingUser) {
    return sessionUser.id;
  }

  const emailUser = sqlite
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(sessionUser.email || "") as { id: string } | undefined;

  if (emailUser) {
    sessionUser.id = emailUser.id;
    return emailUser.id;
  }

  sqlite
    .prepare("INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)")
    .run(sessionUser.id, sessionUser.name || "User", sessionUser.email || "", "user");

  return sessionUser.id;
}

export async function POST(req: NextRequest) {
  let uploadedLocalFilePath: string | null = null;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      const sqlite = new Database(DB_PATH);

      const authorId = ensureUserRecord(sqlite, session.user);
      if (!authorId) {
        sqlite.close();
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const categoryId = resolveCategoryId(sqlite, category);
      if (!categoryId) {
        sqlite.close();
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
      }

      sqlite
        .prepare(
          `INSERT INTO notes (id, title, description, category_id, author_id, author_credit,
           thumbnail_url, file_url, file_name, file_type, file_size_bytes, source_url,
           license_type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          noteId,
          title,
          description,
          categoryId,
          authorId,
          authorCredit,
          "",
          resourceUrl,
          "",
          "link",
          0,
          resourceUrl,
          licenseType || "CC-BY-4.0",
          "pending"
        );

      if (tags) {
        insertTags(sqlite, noteId, tags);
      }

      sqlite.close();

      try {
        await appendLinkToExcel({
          noteId,
          title,
          description,
          category,
          link: resourceUrl,
          author: session.user.name || authorCredit,
          authorEmail: session.user.email || "",
          tags: tags || "",
          license: licenseType || "CC-BY-4.0",
        });
      } catch (error) {
        console.error("[Excel] append failed:", error);
      }

      return NextResponse.json({
        success: true,
        noteId,
        message: "Resource shared successfully! It will be reviewed before publishing.",
      });
    }

    if (!file || !title || !description || !category || !authorCredit) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PNG, JPG, WEBP, PDF" },
        { status: 400 }
      );
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
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

    const fileUrl = `/uploads/${fileName}`;
    const thumbnailUrl =
      (await createLocalThumbnail(noteId, fileName, fileBuffer, file.type)) || fileUrl;

    const sqlite = new Database(DB_PATH);

    const authorId = ensureUserRecord(sqlite, session.user);
    if (!authorId) {
      sqlite.close();
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categoryId = resolveCategoryId(sqlite, category);
    if (!categoryId) {
      sqlite.close();
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    sqlite
      .prepare(
        `INSERT INTO notes (id, title, description, category_id, author_id, author_credit,
         thumbnail_url, file_url, file_name, file_type, file_size_bytes, source_url,
         license_type, status, drive_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        noteId,
        title,
        description,
        categoryId,
        authorId,
        authorCredit,
        thumbnailUrl,
        fileUrl,
        file.name,
        file.type,
        file.size,
        sourceUrl || null,
        licenseType || "CC-BY-4.0",
        "pending",
        null
      );

    if (tags) {
      insertTags(sqlite, noteId, tags);
    }

    sqlite.close();

    const stableFileUrl = `${req.nextUrl.origin}/api/files/${noteId}`;

    try {
      await appendLinkToExcel({
        noteId,
        title,
        description,
        category,
        link: stableFileUrl,
        author: session.user.name || authorCredit,
        authorEmail: session.user.email || "",
        tags: tags || "",
        license: licenseType || "CC-BY-4.0",
      });
    } catch (error) {
      console.error("[Excel] append failed for file upload:", error);
    }

    const oneDriveEnabled = isOneDriveConfigured();
    if (oneDriveEnabled) {
      syncNoteToOneDriveInBackground({
        noteId,
        fileBuffer,
        fileName,
        fileType: file.type,
        category,
      });
    }

    return NextResponse.json({
      success: true,
      noteId,
      storage: oneDriveEnabled ? "OneDrive + local fallback" : "local",
      message: oneDriveEnabled
        ? "Note saved locally and queued for background cloud sync. It will be reviewed before publishing."
        : "Note uploaded successfully! It will be reviewed before publishing.",
    });
  } catch (error) {
    console.error("POST /api/upload error:", error);

    if (uploadedLocalFilePath && fs.existsSync(uploadedLocalFilePath)) {
      try {
        fs.unlinkSync(uploadedLocalFilePath);
      } catch {
        // Best effort cleanup for a failed upload transaction.
      }
    }

    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

function insertTags(sqlite: Database.Database, noteId: string, tags: string) {
  const tagList = tags
    .split(",")
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter(Boolean);

  for (const tagSlug of tagList) {
    sqlite.prepare("INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)").run(tagSlug, tagSlug);
    const tagRow = sqlite.prepare("SELECT id FROM tags WHERE slug = ?").get(tagSlug) as { id: number };
    sqlite.prepare("INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)").run(noteId, tagRow.id);
  }
}
