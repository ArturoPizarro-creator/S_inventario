import { NextResponse, type NextRequest } from "next/server";

// Si no hay cookie de sesión, manda a /login. La API valida el token de verdad.
export function middleware(req: NextRequest) {
  if (!req.cookies.get("token")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|brand|_next/static|_next/image|favicon.ico).*)"],
};
