import { NextRequest, NextResponse } from "next/server";
import { SITE_HOST, SITE_URL } from "@/lib/site";

const ADVANCED_ADMIN_PATH_PREFIX = "/admin/advanced-tracks";

export async function proxy(req: NextRequest) {
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const requestHost = forwardedHost.split(":")[0].toLowerCase();

  if (requestHost && requestHost !== SITE_HOST && !requestHost.includes("localhost")) {
    return NextResponse.redirect(new URL(req.nextUrl.pathname + req.nextUrl.search, SITE_URL), 308);
  }

  if (!req.nextUrl.pathname.startsWith(ADVANCED_ADMIN_PATH_PREFIX)) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/advanced-tracks/:path*"],
};
