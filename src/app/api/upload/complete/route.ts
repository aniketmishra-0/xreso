/**
 * POST /api/upload/complete
 * ─────────────────────────
 * Called after the browser has finished uploading a file
 * directly to OneDrive. Saves the note record in the
 * Turso database and logs it to Excel.
 *
 * Request body (JSON):
 *   { driveItemId, title, description, category, tags,
 *     authorCredit, sourceUrl, licenseType, fileName, fileType, fileSize }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appendLinkToExcel } from "@/lib/excel";
import { createClient, Client } from "@libsql/client/web";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

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

function getClient(): Client {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("TURSO_DATABASE_URL is not configured");
  }
  return createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

function normalizeCategorySlug(slug: string): string {
  return CATEGORY_ALIASES[slug] || slug;
}

async function resolveCategoryId(
  client: Client,
  rawSlug: string
): Promise<number | undefined> {
  const slug = normalizeCategorySlug(rawSlug);
  const existing = await client.execute({
    sql: "SELECT id FROM categories WHERE slug = ?",
    args: [slug],
  });
  if (existing.rows.length > 0) return existing.rows[0].id as number;

  const categoryName = CATEGORY_NAMES[slug];
  if (!categoryName) return undefined;

  await client.execute({
    sql: "INSERT OR IGNORE INTO categories (name, slug, description, note_count) VALUES (?, ?, ?, 0)",
    args: [categoryName, slug, `${categoryName} programming notes`],
  });

  const created = await client.execute({
    sql: "SELECT id FROM categories WHERE slug = ?",
    args: [slug],
  });
  return created.rows.length > 0 ? (created.rows[0].id as number) : undefined;
}

async function ensureUserRecord(
  client: Client,
  sessionUser: {
    id?: string;
    email?: string | null;
    name?: string | null;
  }
) {
  if (!sessionUser.id) return null;

  const existing = await client.execute({
    sql: "SELECT id FROM users WHERE id = ?",
    args: [sessionUser.id],
  });
  if (existing.rows.length > 0) return sessionUser.id;

  const email = sessionUser.email || "";
  const byEmail = await client.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: [email],
  });
  if (byEmail.rows.length > 0) {
    return byEmail.rows[0].id as string;
  }

  await client.execute({
    sql: "INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)",
    args: [sessionUser.id, sessionUser.name || "User", email, "user"],
  });
  return sessionUser.id;
}

async function insertTags(client: Client, noteId: string, tags: string) {
  const tagList = tags
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter(Boolean);
  for (const tagSlug of tagList) {
    await client.execute({
      sql: "INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)",
      args: [tagSlug, tagSlug],
    });
    const tagRes = await client.execute({
      sql: "SELECT id FROM tags WHERE slug = ?",
      args: [tagSlug],
    });
    if (tagRes.rows.length > 0) {
      await client.execute({
        sql: "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)",
        args: [noteId, tagRes.rows[0].id as number],
      });
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      driveItemId,
      title,
      description,
      category,
      tags,
      authorCredit,
      sourceUrl,
      licenseType,
      fileName,
      fileType,
      fileSize,
    } = body as {
      driveItemId?: string;
      title?: string;
      description?: string;
      category?: string;
      tags?: string;
      authorCredit?: string;
      sourceUrl?: string;
      licenseType?: string;
      fileName?: string;
      fileType?: string;
      fileSize?: number;
    };

    if (!driveItemId || !title || !description || !category || !authorCredit) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const client = getClient();
    const noteId = uuidv4();

    const authorId = await ensureUserRecord(client, session.user);
    if (!authorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categoryId = await resolveCategoryId(client, category);
    if (!categoryId) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    const fileUrl = `/api/files/${noteId}`;
    const thumbnailUrl = fileUrl; // Will use OG image or proxy

    // Try insert with drive_item_id
    try {
      await client.execute({
        sql: `INSERT INTO notes (id, title, description, category_id, author_id, author_credit,
              thumbnail_url, file_url, file_name, file_type, file_size_bytes,
              source_url, license_type, status, drive_item_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          noteId,
          title,
          description,
          categoryId,
          authorId,
          authorCredit,
          thumbnailUrl,
          fileUrl,
          fileName || "file",
          fileType || "application/pdf",
          fileSize || 0,
          sourceUrl || null,
          licenseType || "CC-BY-4.0",
          "pending",
          driveItemId,
        ],
      });
    } catch (insertError) {
      // Fallback without drive_item_id column
      const msg =
        insertError instanceof Error
          ? insertError.message.toLowerCase()
          : "";
      if (
        msg.includes("no such column") ||
        msg.includes("has no column named")
      ) {
        await client.execute({
          sql: `INSERT INTO notes (id, title, description, category_id, author_id, author_credit,
                thumbnail_url, file_url, file_name, file_type, file_size_bytes,
                source_url, license_type, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            noteId,
            title,
            description,
            categoryId,
            authorId,
            authorCredit,
            thumbnailUrl,
            fileUrl,
            fileName || "file",
            fileType || "application/pdf",
            fileSize || 0,
            sourceUrl || null,
            licenseType || "CC-BY-4.0",
            "pending",
          ],
        });
      } else {
        throw insertError;
      }
    }

    // Insert tags
    if (tags) {
      await insertTags(client, noteId, tags);
    }

    // Log to Excel
    try {
      const stableFileUrl = `${req.nextUrl.origin}/api/files/${noteId}`;
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
    } catch (excelError) {
      console.error("[Excel] append failed:", excelError);
    }

    return NextResponse.json({
      success: true,
      noteId,
      storage: "onedrive",
      message: "Note uploaded successfully! It will be reviewed before publishing.",
    });
  } catch (error) {
    console.error("POST /api/upload/complete error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
