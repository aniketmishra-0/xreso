import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@libsql/client/web";

export const dynamic = "force-dynamic";

function getClient() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) throw new Error("TURSO_DATABASE_URL is not configured");
  return createClient({ url: databaseUrl, authToken: process.env.TURSO_AUTH_TOKEN });
}

// GET /api/admin/users — List all users
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (session.user as { role?: string }).role || "user";
    if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const client = getClient();

    // Safely add role column if it doesn't exist (using empty default to satisfy SQLite)
    try {
      await client.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
    } catch { /* already exists */ }

    // Fetch users without strictly requesting non-standard NextAuth columns
    const result = await client.execute(`
      SELECT 
        u.*,
        (SELECT COUNT(*) FROM notes WHERE author_id = u.id) as note_count,
        (SELECT COALESCE(SUM(view_count),0) FROM notes WHERE author_id = u.id) as total_views
      FROM users u
    `);

    const users = result.rows.map((row) => {
      const r: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        r[k] = typeof v === "bigint" ? Number(v) : v;
      }
      // Provide fallbacks for missing NextAuth columns
      r.role = typeof r.role === 'string' && r.role ? r.role : "user";
      r.created_at = r.created_at || r.emailVerified || new Date().toISOString(); 
      return r;
    });

    // Sort in memory to avoid SQL missing column errors
    users.sort((a, b) => {
      const da = new Date(a.created_at as string).getTime();
      const db = new Date(b.created_at as string).getTime();
      return db - da; // Descending
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH /api/admin/users — Update user role
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (session.user as { role?: string }).role || "user";
    if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId, newRole } = (await req.json()) as { userId?: string; newRole?: string };
    if (!userId || !newRole) return NextResponse.json({ error: "Missing userId or newRole" }, { status: 400 });

    const allowedRoles = ["user", "moderator", "admin", "banned"];
    if (!allowedRoles.includes(newRole)) {
      return NextResponse.json({ error: `Invalid role: ${newRole}` }, { status: 400 });
    }

    // Prevent self-demotion
    if (userId === (session.user as { id?: string }).id && newRole !== "admin") {
      return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
    }

    const client = getClient();
    await client.execute({
      sql: "UPDATE users SET role = ? WHERE id = ?",
      args: [newRole, userId],
    });

    // Log the action
    await client.execute({
      sql: `INSERT INTO audit_logs (id, admin_email, action, target_type, target_id, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        crypto.randomUUID(),
        session.user.email || "unknown",
        "role_change",
        "user",
        userId,
        `Changed role to ${newRole}`,
      ],
    }).catch(() => { /* audit table may not exist yet */ });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/admin/users error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}

// DELETE /api/admin/users — Delete a user account (spammers)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (session.user as { role?: string }).role || "user";
    if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId } = (await req.json()) as { userId?: string };
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    if (userId === (session.user as { id?: string }).id) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    const client = getClient();
    
    // Anonymize their notes so the platform doesn't lose resources
    try {
      await client.execute({
        sql: "UPDATE notes SET author_id = NULL, author_credit = 'Deleted User' WHERE author_id = ?",
        args: [userId],
      });
    } catch {}

    // Delete related user data
    try { await client.execute({ sql: "DELETE FROM accounts WHERE userId = ?", args: [userId] }); } catch {}
    try { await client.execute({ sql: "DELETE FROM versions WHERE userId = ?", args: [userId] }); } catch {}
    try { await client.execute({ sql: "DELETE FROM accounts WHERE user_id = ?", args: [userId] }); } catch {}
    try { await client.execute({ sql: "DELETE FROM sessions WHERE userId = ?", args: [userId] }); } catch {}
    try { await client.execute({ sql: "DELETE FROM sessions WHERE user_id = ?", args: [userId] }); } catch {}
    
    // Actually delete the user
    await client.execute({ sql: "DELETE FROM users WHERE id = ?", args: [userId] });

    // Log the action
    await client.execute({
      sql: `INSERT INTO audit_logs (id, admin_email, action, target_type, target_id, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        crypto.randomUUID(),
        session.user.email || "unknown",
        "user_deleted",
        "user",
        userId,
        `Deleted user account completely`,
      ],
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/users error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}
