import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "xreso.db");
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// POST /api/upload — Upload a note with file
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const category = formData.get("category") as string;
    const tags = formData.get("tags") as string;
    const authorCredit = formData.get("authorCredit") as string;
    const sourceUrl = formData.get("sourceUrl") as string;
    const licenseType = formData.get("licenseType") as string;

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
    const filePath = path.join(UPLOAD_DIR, fileName);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, fileBuffer);

    const fileUrl = `/uploads/${fileName}`;

    let thumbnailUrl = fileUrl;
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

    const sqlite = new Database(DB_PATH);

    const cat = sqlite
      .prepare("SELECT id FROM categories WHERE slug = ?")
      .get(category) as { id: number } | undefined;

    if (!cat) {
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
        noteId, title, description, cat.id, session.user.id, authorCredit,
        thumbnailUrl, fileUrl, file.name, file.type, file.size,
        sourceUrl || null, licenseType || "CC-BY-4.0", "pending"
      );

    if (tags) {
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

    sqlite.close();

    return NextResponse.json({
      success: true,
      noteId,
      message: "Note uploaded successfully! It will be reviewed before publishing.",
    });
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
