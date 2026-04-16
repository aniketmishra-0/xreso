import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");

type Role = "user" | "admin" | "moderator";

function hasActivePremiumEntitlement(
  premiumAccess: number,
  premiumExpiresAt: string | null
) {
  if (!premiumAccess) return false;
  if (!premiumExpiresAt) return true;

  const expiresAt = Date.parse(premiumExpiresAt);
  if (Number.isNaN(expiresAt)) return false;

  return expiresAt > Date.now();
}

function normalizePremiumExpiry(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("premiumExpiresAt must be an ISO date string or null");
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsedTime = Date.parse(trimmed);
  if (Number.isNaN(parsedTime)) {
    throw new Error("premiumExpiresAt is invalid");
  }

  return new Date(parsedTime).toISOString();
}

function isPremiumSchemaMissing(error: unknown) {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("no such column") && msg.includes("premium_");
}

async function getCurrentUserRole(_sqlite: Database.Database) {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: 401 as const, role: null };
  }

  const role = ((session.user as { role?: string }).role || "user") as Role;
  return { status: 200 as const, role };
}

export async function GET() {
  const sqlite = new Database(DB_PATH);

  try {
    const current = await getCurrentUserRole(sqlite);
    if (current.status !== 200) {
      return NextResponse.json({ error: "Unauthorized" }, { status: current.status });
    }

    if (current.role !== "admin" && current.role !== "moderator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = sqlite
      .prepare(
        `SELECT
          id,
          name,
          email,
          role,
          premium_access,
          premium_expires_at,
          created_at
         FROM users
         ORDER BY
           CASE role WHEN 'admin' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END,
           created_at DESC`
      )
      .all() as Array<{
      id: string;
      name: string;
      email: string;
      role: Role;
      premium_access: number;
      premium_expires_at: string | null;
      created_at: string;
    }>;

    const users = rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      premiumAccess: Boolean(row.premium_access),
      premiumExpiresAt: row.premium_expires_at,
      premiumActive: hasActivePremiumEntitlement(
        row.premium_access,
        row.premium_expires_at
      ),
      createdAt: row.created_at,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("GET /api/admin/entitlements error:", error);

    if (isPremiumSchemaMissing(error)) {
      return NextResponse.json(
        { error: "Premium entitlement columns are missing. Run db:migrate." },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    sqlite.close();
  }
}

export async function PATCH(req: NextRequest) {
  const sqlite = new Database(DB_PATH);

  try {
    const current = await getCurrentUserRole(sqlite);
    if (current.status !== 200) {
      return NextResponse.json({ error: "Unauthorized" }, { status: current.status });
    }

    if (current.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can update premium entitlements" },
        { status: 403 }
      );
    }

    const payload = (await req.json()) as {
      userId?: unknown;
      premiumAccess?: unknown;
      premiumExpiresAt?: unknown;
    };

    const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (typeof payload.premiumAccess !== "boolean") {
      return NextResponse.json(
        { error: "premiumAccess must be a boolean" },
        { status: 400 }
      );
    }

    const premiumAccess = payload.premiumAccess;
    const premiumExpiresAt = premiumAccess
      ? normalizePremiumExpiry(payload.premiumExpiresAt)
      : null;

    const existing = sqlite
      .prepare("SELECT id FROM users WHERE id = ?")
      .get(userId) as { id: string } | undefined;

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    sqlite
      .prepare(
        `UPDATE users
         SET premium_access = ?,
             premium_expires_at = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(premiumAccess ? 1 : 0, premiumExpiresAt, userId);

    const updated = sqlite
      .prepare(
        `SELECT id, name, email, role, premium_access, premium_expires_at, created_at
         FROM users
         WHERE id = ?`
      )
      .get(userId) as {
      id: string;
      name: string;
      email: string;
      role: Role;
      premium_access: number;
      premium_expires_at: string | null;
      created_at: string;
    };

    return NextResponse.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        premiumAccess: Boolean(updated.premium_access),
        premiumExpiresAt: updated.premium_expires_at,
        premiumActive: hasActivePremiumEntitlement(
          updated.premium_access,
          updated.premium_expires_at
        ),
        createdAt: updated.created_at,
      },
    });
  } catch (error) {
    console.error("PATCH /api/admin/entitlements error:", error);

    if (error instanceof Error && error.message.includes("premiumExpiresAt")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (isPremiumSchemaMissing(error)) {
      return NextResponse.json(
        { error: "Premium entitlement columns are missing. Run db:migrate." },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    sqlite.close();
  }
}
