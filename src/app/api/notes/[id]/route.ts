import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");

// GET /api/notes/[id] — Get single note
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sqlite = new Database(DB_PATH, { readonly: false });

    const row = sqlite.prepare(`
      SELECT n.*, c.name as category_name, c.slug as category_slug,
             u.name as author_name, u.avatar as author_avatar, u.bio as author_bio
      FROM notes n
      LEFT JOIN categories c ON n.category_id = c.id
      LEFT JOIN users u ON n.author_id = u.id
      WHERE n.id = ?
    `).get(id) as Record<string, unknown> | undefined;

    if (!row) {
      sqlite.close();
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Increment view count
    sqlite.prepare("UPDATE notes SET view_count = view_count + 1 WHERE id = ?").run(id);
    sqlite.prepare("INSERT INTO views (note_id) VALUES (?)").run(id);

    const tagRows = sqlite.prepare(`
      SELECT t.name FROM note_tags nt JOIN tags t ON nt.tag_id = t.id WHERE nt.note_id = ?
    `).all(id) as { name: string }[];

    const note = {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category_name,
      categorySlug: row.category_slug,
      author: row.author_name,
      authorAvatar: row.author_avatar,
      authorBio: row.author_bio,
      authorId: row.author_id,
      authorCredit: row.author_credit,
      thumbnailUrl: row.thumbnail_url,
      fileUrl: row.file_url,
      fileName: row.file_name,
      fileType: row.file_type,
      fileSizeBytes: row.file_size_bytes,
      sourceUrl: row.source_url,
      licenseType: row.license_type,
      status: row.status,
      featured: row.featured === 1,
      viewCount: (row.view_count as number) + 1,
      bookmarkCount: row.bookmark_count,
      tags: tagRows.map((t) => t.name),
      createdAt: row.created_at,
    };

    sqlite.close();
    return NextResponse.json({ note });
  } catch (error) {
    console.error("GET /api/notes/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
