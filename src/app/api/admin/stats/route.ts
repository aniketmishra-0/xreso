import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");

// GET /api/admin/stats — Dashboard statistics
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

    if (!user || user.role !== "admin") {
      sqlite.close();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stats = {
      totalNotes: (sqlite.prepare("SELECT COUNT(*) as c FROM notes").get() as { c: number }).c,
      approvedNotes: (sqlite.prepare("SELECT COUNT(*) as c FROM notes WHERE status = 'approved'").get() as { c: number }).c,
      pendingNotes: (sqlite.prepare("SELECT COUNT(*) as c FROM notes WHERE status = 'pending'").get() as { c: number }).c,
      totalUsers: (sqlite.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c,
      totalViews: (sqlite.prepare("SELECT SUM(view_count) as c FROM notes").get() as { c: number }).c || 0,
      totalBookmarks: (sqlite.prepare("SELECT SUM(bookmark_count) as c FROM notes").get() as { c: number }).c || 0,
      pendingReports: (sqlite.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'pending'").get() as { c: number }).c,
      recentViews: (sqlite.prepare("SELECT COUNT(*) as c FROM views WHERE viewed_at > datetime('now', '-7 days')").get() as { c: number }).c,
    };

    sqlite.close();
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("GET /api/admin/stats error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
