import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appendAdminActionToExcel, updateLinkStatusInExcel } from "@/lib/excel";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");

function deleteLocalUploadFile(fileUrl?: string | null) {
  if (!fileUrl || !fileUrl.startsWith("/uploads/")) return;

  const absolutePath = path.join(process.cwd(), "public", fileUrl);
  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    console.warn(`[Admin Delete] Failed to remove local file: ${absolutePath}`, error);
  }
}

function rebuildNotesFtsIndex(sqlite: Database.Database) {
  try {
    sqlite.prepare("INSERT INTO notes_fts(notes_fts) VALUES('delete-all')").run();
    sqlite
      .prepare(
        `INSERT INTO notes_fts(rowid, title, description, tags)
         SELECT n.rowid,
                n.title,
                n.description,
                COALESCE((
                  SELECT GROUP_CONCAT(t.name, ' ')
                  FROM note_tags nt
                  JOIN tags t ON nt.tag_id = t.id
                  WHERE nt.note_id = n.id
                ), '')
         FROM notes n
         WHERE n.status = 'approved'`
      )
      .run();
  } catch (error) {
    console.warn("[Admin Delete] FTS rebuild skipped:", error);
  }
}

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
      .prepare("SELECT role, name, email FROM users WHERE id = ?")
      .get(session.user.id) as { role: string; name: string; email: string } | undefined;

    if (!user || (user.role !== "admin" && user.role !== "moderator")) {
      sqlite.close();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { noteId, action, featured } = await req.json();
    const previousNote = sqlite
      .prepare("SELECT status, featured, title, category_id FROM notes WHERE id = ?")
      .get(noteId) as { status: string; featured: number; title: string; category_id: number } | undefined;
    const categoryName = previousNote
      ? (sqlite
          .prepare("SELECT name FROM categories WHERE id = ?")
          .get(previousNote.category_id) as { name: string } | undefined)
      : undefined;

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

    const syncRow = sqlite
      .prepare(
        `SELECT n.status as note_status,
                COALESCE(u.name, n.author_credit, 'Unknown') as author_name,
                COALESCE(u.email, '') as author_email
         FROM notes n
         LEFT JOIN users u ON n.author_id = u.id
         WHERE n.id = ?`
      )
      .get(noteId) as { note_status: string; author_name: string; author_email: string } | undefined;

    sqlite.close();

    if (syncRow) {
      const mappedStatus: "Pending" | "Approved" | "Rejected" =
        syncRow.note_status === "approved"
          ? "Approved"
          : syncRow.note_status === "rejected"
            ? "Rejected"
            : "Pending";

      await updateLinkStatusInExcel({
        noteId,
        status: mappedStatus,
        authorName: syncRow.author_name,
        authorEmail: syncRow.author_email,
      });
    }

    if (previousNote && user) {
      const adminId = session.user.id as string;
      const nextStatus =
        action === "approve"
          ? "approved"
          : action === "reject"
            ? "rejected"
            : previousNote.status;

      await appendAdminActionToExcel({
        adminId,
        adminName: user.name,
        adminEmail: user.email,
        noteId,
        noteTitle: previousNote.title,
        category: categoryName?.name || "Unknown",
        action: action === "feature" ? "featured" : action === "approve" ? "approved" : "rejected",
        previousStatus: previousNote.status,
        newStatus: nextStatus,
        featured: action === "feature" ? Boolean(featured) : Boolean(previousNote.featured),
        details:
          action === "feature"
            ? `Featured toggled to ${featured ? "on" : "off"}`
            : `Status changed to ${nextStatus}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/admin/notes error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/admin/notes — Permanently delete a note (admin only)
export async function DELETE(req: NextRequest) {
  let sqlite: Database.Database | null = null;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    sqlite = new Database(DB_PATH);

    const user = sqlite
      .prepare("SELECT role, name, email FROM users WHERE id = ?")
      .get(session.user.id) as { role: string; name: string; email: string } | undefined;

    if (!user || user.role !== "admin") {
      sqlite.close();
      sqlite = null;
      return NextResponse.json({ error: "Only admins can delete notes" }, { status: 403 });
    }

    const { noteId } = await req.json();
    if (typeof noteId !== "string" || !noteId.trim()) {
      sqlite.close();
      sqlite = null;
      return NextResponse.json({ error: "Missing noteId" }, { status: 400 });
    }

    const existing = sqlite
      .prepare(
       `SELECT n.id, n.category_id, n.title, n.file_url, n.thumbnail_url,
          COALESCE(u.name, n.author_credit, 'Unknown') as author_name,
          COALESCE(u.email, '') as author_email
        FROM notes n
        LEFT JOIN users u ON n.author_id = u.id
        WHERE n.id = ?`
      )
      .get(noteId) as {
      id: string;
      category_id: number;
          title: string;
      file_url: string | null;
      thumbnail_url: string | null;
      author_name: string;
      author_email: string;
    } | undefined;

    const categoryName = existing
      ? (sqlite
          .prepare("SELECT name FROM categories WHERE id = ?")
          .get(existing.category_id) as { name: string } | undefined)
      : undefined;

    if (!existing) {
      sqlite.close();
      sqlite = null;
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const deleteTx = sqlite.transaction((id: string, categoryId: number) => {
      sqlite?.prepare("DELETE FROM note_tags WHERE note_id = ?").run(id);
      sqlite?.prepare("DELETE FROM bookmarks WHERE note_id = ?").run(id);
      sqlite?.prepare("DELETE FROM views WHERE note_id = ?").run(id);
      sqlite?.prepare("DELETE FROM reports WHERE note_id = ?").run(id);
      sqlite?.prepare("DELETE FROM notes WHERE id = ?").run(id);
      sqlite?.prepare("DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags)").run();

      if (sqlite) {
        rebuildNotesFtsIndex(sqlite);
      }

      sqlite
        ?.prepare(
          "UPDATE categories SET note_count = (SELECT COUNT(*) FROM notes WHERE notes.category_id = ? AND notes.status = 'approved') WHERE id = ?"
        )
        .run(categoryId, categoryId);
    });

    deleteTx(existing.id, existing.category_id);

    sqlite.close();
    sqlite = null;

    deleteLocalUploadFile(existing.file_url);
    deleteLocalUploadFile(existing.thumbnail_url);

    await updateLinkStatusInExcel({
      noteId: existing.id,
      status: "Rejected",
      authorName: existing.author_name,
      authorEmail: existing.author_email,
    });

    if (session?.user) {
      const adminId = session.user.id as string;
      await appendAdminActionToExcel({
        adminId,
        adminName: session.user.name || "Admin",
        adminEmail: session.user.email || "",
        noteId: existing.id,
        noteTitle: existing.title,
        category: categoryName?.name || "Unknown",
        action: "deleted",
        previousStatus: "approved",
        newStatus: "deleted",
        featured: false,
        details: "Permanent note deletion from admin panel",
      });
    }

    return NextResponse.json({ success: true, noteId: existing.id });
  } catch (error) {
    if (sqlite) {
      sqlite.close();
    }

    console.error("DELETE /api/admin/notes error:", error);
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
