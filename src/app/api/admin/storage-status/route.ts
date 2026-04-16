import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getExcelStorageStatus } from "@/lib/excel";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionRole = (session.user as { role?: string }).role || "user";
    if (sessionRole !== "admin") {
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
