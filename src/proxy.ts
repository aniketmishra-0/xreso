import { NextRequest, NextResponse } from "next/server";

const ADVANCED_ADMIN_PATH_PREFIX = "/admin/advanced-tracks";

export async function proxy(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith(ADVANCED_ADMIN_PATH_PREFIX)) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/advanced-tracks/:path*"],
};
