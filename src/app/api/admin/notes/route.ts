import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appendAdminActionToExcel, updateLinkStatusInExcel } from "@/lib/excel";
import { deleteOneDriveItem } from "@/lib/onedrive";
import { runAutoApprovalSweepIfNeeded } from "@/lib/moderation";
import { createClient, Client } from "@libsql/client/web";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "");
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const normalizedColumn = columnName.toLowerCase();
  return (
    message.includes(`no such column: ${normalizedColumn}`) ||
    message.includes(`has no column named ${normalizedColumn}`) ||
    message.includes(`unknown column: ${normalizedColumn}`)
  );
}

function normalizeRecord(row: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    output[key] = typeof value === "bigint" ? Number(value) : value;
  }
  return output;
}

function asNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

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

async function getDeleteCandidate(client: Client, noteId: string) {
  const selectWithDriveItem = `SELECT n.id,
      n.category_id,
      n.title,
      n.file_url,
      n.thumbnail_url,
      n.drive_item_id,
      COALESCE(u.name, n.author_credit, 'Unknown') as author_name,
      COALESCE(u.email, '') as author_email
    FROM notes n
    LEFT JOIN users u ON n.author_id = u.id
    WHERE n.id = ?`;

  try {
    const withDriveItem = await client.execute({
      sql: selectWithDriveItem,
      args: [noteId],
    });

    if (withDriveItem.rows.length === 0) return null;

    return normalizeRecord(withDriveItem.rows[0] as Record<string, unknown>);
  } catch (error) {
    if (!isMissingColumnError(error, "drive_item_id")) {
      throw error;
    }
  }

  const fallback = await client.execute({
    sql: `SELECT n.id,
      n.category_id,
      n.title,
      n.file_url,
      n.thumbnail_url,
      COALESCE(u.name, n.author_credit, 'Unknown') as author_name,
      COALESCE(u.email, '') as author_email
    FROM notes n
    LEFT JOIN users u ON n.author_id = u.id
    WHERE n.id = ?`,
    args: [noteId],
  });

  if (fallback.rows.length === 0) return null;

  return {
    ...normalizeRecord(fallback.rows[0] as Record<string, unknown>),
    drive_item_id: null,
  };
}

// GET /api/admin/notes — List all notes for moderation
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionRole = (session.user as { role?: string }).role || "user";
    if (sessionRole !== "admin" && sessionRole !== "moderator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    runAutoApprovalSweepIfNeeded();

    const client = getClient();
    const result = await client.execute(`SELECT n.*, c.name as category_name, u.name as author_name, u.email as author_email
        FROM notes n
        LEFT JOIN categories c ON n.category_id = c.id
        LEFT JOIN users u ON n.author_id = u.id
        ORDER BY
          CASE n.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
          n.created_at DESC`);

    const notes = result.rows.map((row) => normalizeRecord(row as Record<string, unknown>));
    return NextResponse.json({ notes });
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

    const sessionRole = (session.user as { role?: string }).role || "user";
    if (sessionRole !== "admin" && sessionRole !== "moderator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const client = getClient();
    const { noteId, action, featured } = (await req.json()) as {
      noteId?: string;
      action?: "approve" | "reject" | "feature";
      featured?: boolean;
    };

    const normalizedNoteId = typeof noteId === "string" ? noteId.trim() : "";
    if (!normalizedNoteId || !action) {
      return NextResponse.json({ error: "Missing noteId/action" }, { status: 400 });
    }

    const previousResult = await client.execute({
      sql: "SELECT status, featured, title, category_id FROM notes WHERE id = ? LIMIT 1",
      args: [normalizedNoteId],
    });

    if (previousResult.rows.length === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const previousNote = normalizeRecord(
      previousResult.rows[0] as Record<string, unknown>
    ) as {
      status: string;
      featured: number;
      title: string;
      category_id: number;
    };

    const categoryResult = await client.execute({
      sql: "SELECT name FROM categories WHERE id = ? LIMIT 1",
      args: [previousNote.category_id],
    });

    const categoryName = asString(categoryResult.rows[0]?.name, "Unknown");

    if (action === "approve") {
      await client.execute({
        sql: "UPDATE notes SET status = 'approved', updated_at = datetime('now') WHERE id = ?",
        args: [normalizedNoteId],
      });

      await client.execute(`UPDATE categories
        SET note_count = (
          SELECT COUNT(*)
          FROM notes
          WHERE notes.category_id = categories.id
            AND notes.status = 'approved'
        )`);
    } else if (action === "reject") {
      await client.execute({
        sql: "UPDATE notes SET status = 'rejected', updated_at = datetime('now') WHERE id = ?",
        args: [normalizedNoteId],
      });
    } else if (action === "feature") {
      await client.execute({
        sql: "UPDATE notes SET featured = ?, updated_at = datetime('now') WHERE id = ?",
        args: [featured ? 1 : 0, normalizedNoteId],
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const syncRowResult = await client.execute({
      sql: `SELECT n.status as note_status,
                COALESCE(u.name, n.author_credit, 'Unknown') as author_name,
                COALESCE(u.email, '') as author_email
         FROM notes n
         LEFT JOIN users u ON n.author_id = u.id
         WHERE n.id = ?
         LIMIT 1`,
      args: [normalizedNoteId],
    });

    const syncRow =
      syncRowResult.rows.length > 0
        ? (normalizeRecord(syncRowResult.rows[0] as Record<string, unknown>) as {
            note_status: string;
            author_name: string;
            author_email: string;
          })
        : null;

    if (syncRow) {
      const mappedStatus: "Pending" | "Approved" | "Rejected" =
        syncRow.note_status === "approved"
          ? "Approved"
          : syncRow.note_status === "rejected"
            ? "Rejected"
            : "Pending";

      await updateLinkStatusInExcel({
        noteId: normalizedNoteId,
        status: mappedStatus,
        authorName: syncRow.author_name,
        authorEmail: syncRow.author_email,
      });
    }

    const nextStatus =
      action === "approve"
        ? "approved"
        : action === "reject"
          ? "rejected"
          : previousNote.status;

    await appendAdminActionToExcel({
      adminId: session.user.id as string,
      adminName: session.user.name || "Admin",
      adminEmail: session.user.email || "",
      noteId: normalizedNoteId,
      noteTitle: previousNote.title,
      category: categoryName,
      action: action === "feature" ? "featured" : action === "approve" ? "approved" : "rejected",
      previousStatus: previousNote.status,
      newStatus: nextStatus,
      featured: action === "feature" ? Boolean(featured) : Boolean(previousNote.featured),
      details:
        action === "feature"
          ? `Featured toggled to ${featured ? "on" : "off"}`
          : `Status changed to ${nextStatus}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/admin/notes error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/admin/notes — Permanently delete a note (admin only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionRole = (session.user as { role?: string }).role || "user";
    if (sessionRole !== "admin") {
      return NextResponse.json({ error: "Only admins can delete notes" }, { status: 403 });
    }

    const payload = (await req.json()) as { noteId?: string };
    const noteId = typeof payload.noteId === "string" ? payload.noteId.trim() : "";

    if (!noteId) {
      return NextResponse.json({ error: "Missing noteId" }, { status: 400 });
    }

    const client = getClient();

    const existing = await getDeleteCandidate(client, noteId);
    if (!existing) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const categoryId = asNumber(existing.category_id, 0);
    const categoryResult = await client.execute({
      sql: "SELECT name FROM categories WHERE id = ? LIMIT 1",
      args: [categoryId],
    });
    const categoryName = asString(categoryResult.rows[0]?.name, "Unknown");

    await client.execute({ sql: "DELETE FROM note_tags WHERE note_id = ?", args: [noteId] });
    await client.execute({ sql: "DELETE FROM bookmarks WHERE note_id = ?", args: [noteId] });
    await client.execute({ sql: "DELETE FROM views WHERE note_id = ?", args: [noteId] });
    await client.execute({ sql: "DELETE FROM reports WHERE note_id = ?", args: [noteId] });
    await client.execute({ sql: "DELETE FROM notes WHERE id = ?", args: [noteId] });
    await client.execute("DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags)");

    if (categoryId > 0) {
      await client.execute({
        sql: `UPDATE categories
          SET note_count = (
            SELECT COUNT(*)
            FROM notes
            WHERE notes.category_id = ?
              AND notes.status = 'approved'
          )
          WHERE id = ?`,
        args: [categoryId, categoryId],
      });
    }

    const driveItemId = asString(existing.drive_item_id, "").trim();
    if (driveItemId) {
      try {
        await deleteOneDriveItem(driveItemId);
      } catch (driveDeleteError) {
        console.warn(`[Admin Delete] Failed to remove OneDrive file ${driveItemId}:`, driveDeleteError);
      }
    }

    deleteLocalUploadFile(asString(existing.file_url, ""));
    deleteLocalUploadFile(asString(existing.thumbnail_url, ""));

    await updateLinkStatusInExcel({
      noteId,
      status: "Rejected",
      authorName: asString(existing.author_name, "Unknown"),
      authorEmail: asString(existing.author_email, ""),
    });

    await appendAdminActionToExcel({
      adminId: session.user.id as string,
      adminName: session.user.name || "Admin",
      adminEmail: session.user.email || "",
      noteId,
      noteTitle: asString(existing.title, "Untitled"),
      category: categoryName,
      action: "deleted",
      previousStatus: "approved",
      newStatus: "deleted",
      featured: false,
      details: "Permanent note deletion from admin panel",
    });

    return NextResponse.json({ success: true, noteId });
  } catch (error) {
    console.error("DELETE /api/admin/notes error:", error);
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
