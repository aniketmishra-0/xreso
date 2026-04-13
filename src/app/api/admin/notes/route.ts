import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");

// GET /api/admin/notes — List all notes for moderation
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sqlite = new Database(DB_PATH, { readonly: true });

    const user = sqlite
      .prepare("SELECT role FROM users WHERE id = ?")
      .get(session.user.id) as { role: string } | undefined;

    if (!user || (user.role !== "admin" && user.role !== "moderator")) {
      sqlite.close();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = sqlite
      .prepare(
        `SELECT n.*, c.name as category_name, u.name as author_name, u.email as author_email
        FROM notes n
        LEFT JOIN categories c ON n.category_id = c.id
        LEFT JOIN users u ON n.author_id = u.id
        ORDER BY 
          CASE n.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
          n.created_at DESC`
      )
      .all() as Record<string, unknown>[];

    sqlite.close();
    return NextResponse.json({ notes: rows });
  } catch (error) {
    console.error("GET /api/admin/notes error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH /api/admin/notes — Update note status (approve/reject)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sqlite = new Database(DB_PATH);

    const user = sqlite
      .prepare("SELECT role FROM users WHERE id = ?")
      .get(session.user.id) as { role: string } | undefined;

    if (!user || (user.role !== "admin" && user.role !== "moderator")) {
      sqlite.close();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { noteId, action, featured } = await req.json();

    if (action === "approve") {
      sqlite
        .prepare("UPDATE notes SET status = 'approved', updated_at = datetime('now') WHERE id = ?")
        .run(noteId);

      const note = sqlite.prepare("SELECT rowid, title, description FROM notes WHERE id = ?").get(noteId) as { rowid: number; title: string; description: string } | undefined;
      if (note) {
        const tagsStr = sqlite.prepare(
          "SELECT GROUP_CONCAT(t.name, ' ') as tags FROM note_tags nt JOIN tags t ON nt.tag_id = t.id WHERE nt.note_id = ?"
        ).get(noteId) as { tags: string } | undefined;
        sqlite.prepare(
          "INSERT INTO notes_fts(rowid, title, description, tags) VALUES (?, ?, ?, ?)"
        ).run(note.rowid, note.title, note.description, tagsStr?.tags || "");
      }

      sqlite.exec(`UPDATE categories SET note_count = (SELECT COUNT(*) FROM notes WHERE notes.category_id = categories.id AND notes.status = 'approved')`);
    } else if (action === "reject") {
      sqlite
        .prepare("UPDATE notes SET status = 'rejected', updated_at = datetime('now') WHERE id = ?")
        .run(noteId);
    } else if (action === "feature") {
      sqlite
        .prepare("UPDATE notes SET featured = ?, updated_at = datetime('now') WHERE id = ?")
        .run(featured ? 1 : 0, noteId);
    }

    sqlite.close();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/admin/notes error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
