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
    const result = await client.execute(`
      SELECT u.id, u.name, u.email, u.role, u.image, u.created_at,
        (SELECT COUNT(*) FROM notes WHERE author_id = u.id) as note_count,
        (SELECT COALESCE(SUM(view_count),0) FROM notes WHERE author_id = u.id) as total_views
      FROM users u
      ORDER BY u.created_at DESC
    `);

    const users = result.rows.map((row) => {
      const r: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        r[k] = typeof v === "bigint" ? Number(v) : v;
      }
      return r;
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
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
