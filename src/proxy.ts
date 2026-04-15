import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const ADVANCED_ADMIN_PATH_PREFIX = "/admin/advanced-tracks";

export async function proxy(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith(ADVANCED_ADMIN_PATH_PREFIX)) {
    return NextResponse.next();
  }

  const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!authSecret) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set(
      "callbackUrl",
      `${req.nextUrl.pathname}${req.nextUrl.search}`
    );
    return NextResponse.redirect(loginUrl);
  }

  const token = await getToken({
    req,
    secret: authSecret,
  });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set(
      "callbackUrl",
      `${req.nextUrl.pathname}${req.nextUrl.search}`
    );
    return NextResponse.redirect(loginUrl);
  }

  const roleValue = (token as { role?: unknown }).role;
  const role = typeof roleValue === "string" ? roleValue : "user";

  if (role !== "admin" && role !== "moderator") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/advanced-tracks/:path*"],
};
