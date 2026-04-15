import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getExcelStorageStatus } from "@/lib/excel";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sqlite = new Database(DB_PATH, { readonly: true });
    const user = sqlite
      .prepare("SELECT role FROM users WHERE id = ?")
      .get(session.user.id) as { role?: string } | undefined;
    sqlite.close();

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storage = await getExcelStorageStatus();
    return NextResponse.json({ storage });
  } catch (error) {
    console.error("GET /api/admin/storage-status error:", error);
    return NextResponse.json(
      { error: "Failed to inspect storage status" },
      { status: 500 }
    );
  }
}
