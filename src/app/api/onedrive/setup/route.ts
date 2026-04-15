import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthUrl, isOneDriveConfigured } from "@/lib/onedrive";

// GET /api/onedrive/setup — Redirect to Microsoft OAuth consent
export async function GET() {
  try {
    const session = await auth();
    const role = (session?.user as { role?: string })?.role;

    if (!session?.user?.id || role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    if (isOneDriveConfigured()) {
      return NextResponse.json({
        message: "OneDrive is already configured!",
        configured: true,
      });
    }

    if (!process.env.ONEDRIVE_CLIENT_ID || !process.env.ONEDRIVE_CLIENT_SECRET) {
      return NextResponse.json({
        error: "Missing ONEDRIVE_CLIENT_ID or ONEDRIVE_CLIENT_SECRET in .env.local",
        configured: false,
        instructions: [
          "1. Go to https://portal.azure.com → Azure Active Directory → App registrations → New",
          "2. Name: 'xreso-onedrive', Account type: Personal Microsoft accounts",
          "3. Redirect URI: http://localhost:3000/api/onedrive/callback",
          "4. Copy Application (client) ID → ONEDRIVE_CLIENT_ID in .env.local",
          "5. Go to Certificates & secrets → New client secret → Copy value → ONEDRIVE_CLIENT_SECRET",
          "6. Go to API permissions → Add: Microsoft Graph → Files.ReadWrite + offline_access",
          "7. Restart server and visit this endpoint again",
        ],
      }, { status: 400 });
    }

    // Redirect to Microsoft consent
    const authUrl = getAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("OneDrive setup error:", error);
    return NextResponse.json({ error: "Setup failed" }, { status: 500 });
  }
}
