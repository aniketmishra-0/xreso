import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@libsql/client/web";
import { runAutoApprovalSweepIfNeeded } from "@/lib/moderation";

function getClient() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("TURSO_DATABASE_URL is not configured");
  }

  return createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
}

function toCount(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

// GET /api/admin/stats — Dashboard statistics
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionRole = (session.user as { role?: string }).role || "user";
    if (sessionRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    runAutoApprovalSweepIfNeeded();

    const client = getClient();

    const [
      totalNotesResult,
      approvedNotesResult,
      pendingNotesResult,
      totalUsersResult,
      totalViewsResult,
      totalBookmarksResult,
      pendingReportsResult,
      recentViewsResult,
    ] = await Promise.all([
      client.execute("SELECT COUNT(*) as c FROM notes"),
      client.execute("SELECT COUNT(*) as c FROM notes WHERE status = 'approved'"),
      client.execute("SELECT COUNT(*) as c FROM notes WHERE status = 'pending'"),
      client.execute("SELECT COUNT(*) as c FROM users"),
      client.execute("SELECT COALESCE(SUM(view_count), 0) as c FROM notes"),
      client.execute("SELECT COALESCE(SUM(bookmark_count), 0) as c FROM notes"),
      client.execute("SELECT COUNT(*) as c FROM reports WHERE status = 'pending'"),
      client.execute("SELECT COUNT(*) as c FROM views WHERE viewed_at > datetime('now', '-7 days')"),
    ]);

    const stats = {
      totalNotes: toCount(totalNotesResult.rows[0]?.c),
      approvedNotes: toCount(approvedNotesResult.rows[0]?.c),
      pendingNotes: toCount(pendingNotesResult.rows[0]?.c),
      totalUsers: toCount(totalUsersResult.rows[0]?.c),
      totalViews: toCount(totalViewsResult.rows[0]?.c),
      totalBookmarks: toCount(totalBookmarksResult.rows[0]?.c),
      pendingReports: toCount(pendingReportsResult.rows[0]?.c),
      recentViews: toCount(recentViewsResult.rows[0]?.c),
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("GET /api/admin/stats error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
