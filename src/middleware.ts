import { NextRequest, NextResponse } from "next/server";
import { isValidEdgeAuthToken } from "@/lib/auth/edge-token";

function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set("auth-token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Simple CSRF protection for mutating API requests
  if (pathname.startsWith("/api/") && ["POST", "DELETE", "PUT", "PATCH"].includes(method)) {
    const requestedWith = request.headers.get("x-requested-with");
    if (requestedWith?.toLowerCase() !== "xmlhttprequest") {
      return NextResponse.json(
        { error: "Forbidden: Missing or invalid X-Requested-With header" },
        { status: 403 }
      );
    }
  }

  const token = request.cookies.get("auth-token")?.value;

  const protectedPath =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/agents") ||
    pathname.startsWith("/chat") ||
    pathname.startsWith("/containers") ||
    pathname.startsWith("/credits") ||
    pathname.startsWith("/integrations");

  if (protectedPath) {
    if (!token) {
      // If the user just came from /login, the cookie may not have propagated
      // yet (Set-Cookie race). Let the client-side auth hook handle the retry
      // instead of hard-redirecting back to /login which creates a loop.
      const referer = request.headers.get("referer") || "";
      const comingFromLogin = referer.includes("/login");
      if (comingFromLogin) {
        // Allow the navigation through — the page will render and the
        // client-side useAuth hook will handle the session check.
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const valid = await isValidEdgeAuthToken(token);
    if (!valid) {
      return clearAuthCookie(NextResponse.redirect(new URL("/login", request.url)));
    }
  }

  if (pathname === "/login" && token) {
    const valid = await isValidEdgeAuthToken(token);
    if (valid) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return clearAuthCookie(NextResponse.next());
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/agents/:path*",
    "/chat/:path*",
    "/containers/:path*",
    "/credits/:path*",
    "/integrations/:path*",
    "/login",
  ],
};
