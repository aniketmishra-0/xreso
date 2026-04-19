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

const ANONYMOUS_USER_ID = "anonymous-uploader";
const ANONYMOUS_USER_EMAIL = "anonymous@xreso.local";
const ANONYMOUS_USER_NAME = "Anonymous";

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
    const sessionUser = session?.user;

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

    if (!driveItemId || !title || !description || !category) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const client = getClient();
    const noteId = uuidv4();
    const normalizedAuthorCredit =
      (authorCredit || sessionUser?.name || ANONYMOUS_USER_NAME).trim() ||
      ANONYMOUS_USER_NAME;

    const authorId = await resolveAuthorId(client, sessionUser);

    const categoryId = await resolveCategoryId(client, category);
    if (!categoryId) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    const fileUrl = `/api/files/${noteId}`;
    const thumbnailUrl = fileUrl; // Will use OG image or proxy

    const autoApprove = await isAutoApproveEnabled(client);
    const initialStatus = autoApprove ? "approved" : "pending";

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
          normalizedAuthorCredit,
          thumbnailUrl,
          fileUrl,
          fileName || "file",
          fileType || "application/pdf",
          fileSize || 0,
          sourceUrl || null,
          licenseType || "CC-BY-4.0",
          initialStatus,
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
            normalizedAuthorCredit,
            thumbnailUrl,
            fileUrl,
            fileName || "file",
            fileType || "application/pdf",
            fileSize || 0,
            sourceUrl || null,
            licenseType || "CC-BY-4.0",
            initialStatus,
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
        author: sessionUser?.name || normalizedAuthorCredit,
        authorEmail: sessionUser?.email || "",
        tags: tags || "",
        license: licenseType || "CC-BY-4.0",
      });
    } catch (excelError) {
      console.error("[Excel] append failed:", excelError);
    }

    if (autoApprove) {
      await client.execute(`UPDATE categories SET note_count = (SELECT COUNT(*) FROM notes WHERE notes.category_id = categories.id AND notes.status = 'approved')`);
    }

    return NextResponse.json({
      success: true,
      noteId,
      storage: "onedrive",
      message: autoApprove
        ? "Note uploaded and approved successfully!"
        : "Note uploaded successfully! It will be reviewed before publishing.",
    });
  } catch (error) {
    console.error("POST /api/upload/complete error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
