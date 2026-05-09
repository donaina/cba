import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/favicon.ico', '/_next'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('access_token')?.value;
  const isLoggedIn = Boolean(accessToken);

  if (isLoggedIn && pathname === '/login') {
    return NextResponse.redirect(new URL('/ops/dashboard', request.url));
  }

  if (!isLoggedIn && !isPublicPath(pathname)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
