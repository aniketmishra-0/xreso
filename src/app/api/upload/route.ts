import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadToOneDrive, uploadThumbnailToOneDrive, isOneDriveConfigured } from "@/lib/onedrive";
import { appendLinkToExcel } from "@/lib/excel";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "xreso.db");
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

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

// POST /api/upload — Upload a note (OneDrive or local fallback)
export async function POST(req: NextRequest) {
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

    // ── Link mode (no file) ──────────────────────────────
    if (uploadMode === "link") {
      if (!title || !description || !category || !authorCredit || !resourceUrl) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const noteId = uuidv4();
      const sqlite = new Database(DB_PATH);

      const existingUser = sqlite
        .prepare("SELECT id FROM users WHERE id = ?")
        .get(session.user.id);

      if (!existingUser) {
        const emailUser = sqlite
          .prepare("SELECT id FROM users WHERE email = ?")
          .get(session.user.email || "") as { id: string } | undefined;

        if (emailUser) {
          session.user.id = emailUser.id;
        } else {
          sqlite
            .prepare("INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)")
            .run(session.user.id, session.user.name || "User", session.user.email || "", "user");
        }
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
          noteId, title, description, categoryId, session.user.id, authorCredit,
          "", resourceUrl, "", "link", 0,
          resourceUrl, licenseType || "CC-BY-4.0", "pending"
        );

      if (tags) {
        insertTags(sqlite, noteId, tags);
      }

      sqlite.close();

      // ── Append to Excel sheet ─────────────────────────
      appendLinkToExcel({
        noteId,
        title,
        description,
        category,
        link: resourceUrl,
        author: session.user.name || authorCredit,
        authorEmail: session.user.email || "",
        tags: tags || "",
        license: licenseType || "CC-BY-4.0",
      }).catch((err) => console.error("[Excel] append failed:", err));

      return NextResponse.json({
        success: true, noteId,
        message: "Resource shared successfully! It will be reviewed before publishing.",
      });
    }

    // ── File mode ────────────────────────────────────────
    if (!file || !title || !description || !category || !authorCredit) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Allowed: PNG, JPG, WEBP, PDF" }, { status: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size: 10MB" }, { status: 400 });
    }

    const noteId = uuidv4();
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const fileName = `${noteId}.${ext}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    let fileUrl = "";
    let thumbnailUrl = "";

    // ── Try OneDrive first ────────────────────────────────
    let driveItemId = "";
    if (isOneDriveConfigured()) {
      try {
        console.log(`[OneDrive] Uploading ${fileName} to category: ${category}`);
        const result = await uploadToOneDrive(fileBuffer, fileName, file.type, category);
        driveItemId = result.driveItemId;
        // Use our secure proxy URL instead of OneDrive sharing link
        fileUrl = `/api/files/${noteId}`;

        // Generate and upload thumbnail
        if (file.type.startsWith("image/")) {
          try {
            const sharp = (await import("sharp")).default;
            const thumbBuffer = await sharp(fileBuffer)
              .resize(400, 300, { fit: "cover" })
              .webp({ quality: 80 })
              .toBuffer();

            const thumbName = `thumb_${noteId}.webp`;
            await uploadThumbnailToOneDrive(thumbBuffer, thumbName, category);
            thumbnailUrl = `/api/files/${noteId}`; // Same proxy
          } catch (e) {
            console.warn("Thumbnail generation failed:", e);
            thumbnailUrl = `/api/files/${noteId}`;
          }
        } else {
          thumbnailUrl = ""; // PDF etc — no thumbnail
        }

        console.log(`[OneDrive] Upload successful. DriveItemId: ${driveItemId}`);
      } catch (err) {
        console.error("[OneDrive] Upload failed, falling back to local:", err);
        // Fall through to local upload
      }
    }

    // ── Local fallback ────────────────────────────────────
    if (!fileUrl) {
      if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      }

      const filePath = path.join(UPLOAD_DIR, fileName);
      fs.writeFileSync(filePath, fileBuffer);
      fileUrl = `/uploads/${fileName}`;
      thumbnailUrl = fileUrl;

      if (file.type.startsWith("image/")) {
        try {
          const sharp = (await import("sharp")).default;
          const thumbDir = path.join(process.cwd(), "public", "uploads", "thumbs");
          if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });
          const thumbPath = path.join(thumbDir, `thumb_${fileName}`);
          await sharp(fileBuffer).resize(400, 300, { fit: "cover" }).toFile(thumbPath);
          thumbnailUrl = `/uploads/thumbs/thumb_${fileName}`;
        } catch (e) {
          console.warn("Thumbnail generation failed, using original:", e);
        }
      }
    }

    // ── Save to database ─────────────────────────────────
    const sqlite = new Database(DB_PATH);

    // Ensure the user exists in DB (auto-create if not)
    const existingUser = sqlite
      .prepare("SELECT id FROM users WHERE id = ?")
      .get(session.user.id);

    if (!existingUser) {
      // Check if user exists with same email but different ID
      const emailUser = sqlite
        .prepare("SELECT id FROM users WHERE email = ?")
        .get(session.user.email || "") as { id: string } | undefined;

      if (emailUser) {
        // Use the existing user's ID for this upload
        session.user.id = emailUser.id;
      } else {
        sqlite
          .prepare("INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)")
          .run(session.user.id, session.user.name || "User", session.user.email || "", "user");
      }
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
        noteId, title, description, categoryId, session.user.id, authorCredit,
        thumbnailUrl, fileUrl, file.name, file.type, file.size,
        sourceUrl || null, licenseType || "CC-BY-4.0", "pending",
        driveItemId || null
      );

    if (tags) {
      insertTags(sqlite, noteId, tags);
    }

    sqlite.close();

    // ── Append to Excel sheet (Backup for file uploads) ──
    appendLinkToExcel({
      noteId,
      title,
      description,
      category,
      link: fileUrl,
      author: session.user.name || authorCredit,
      authorEmail: session.user.email || "",
      tags: tags || "",
      license: licenseType || "CC-BY-4.0",
    }).catch((err) => console.error("[Excel] append failed for file upload:", err));

    const storage = isOneDriveConfigured() ? "OneDrive" : "local";
    return NextResponse.json({
      success: true,
      noteId,
      storage,
      message: `Note uploaded to ${storage} successfully! It will be reviewed before publishing.`,
    });
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

/* ── Helper: insert tags ──────────────────────────────────── */
function insertTags(sqlite: Database.Database, noteId: string, tags: string) {
  const tagList = tags
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter(Boolean);

  for (const tagSlug of tagList) {
    sqlite.prepare("INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)").run(tagSlug, tagSlug);
    const tagRow = sqlite.prepare("SELECT id FROM tags WHERE slug = ?").get(tagSlug) as { id: number };
    sqlite.prepare("INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)").run(noteId, tagRow.id);
  }
}
