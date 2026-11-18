import { NextResponse, type NextRequest } from "next/server";

// Si no hay cookie de sesión, manda a /login. Es solo comodidad: la API valida el token de verdad en cada consulta.
export function proxy(req: NextRequest) {
  if (!req.cookies.get("token")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|brand|robots.txt|_next/static|_next/image|favicon.ico).*)"],
};
