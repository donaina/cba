import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/favicon.ico', '/_next'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function isAdminUser(request: NextRequest): boolean {
  try {
    const raw = request.cookies.get('auth_user')?.value;
    if (!raw) return false;
    const user = JSON.parse(raw) as { permissions?: string[] };
    return Array.isArray(user.permissions) && user.permissions.includes('admin:config');
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('access_token')?.value;
  const isLoggedIn = Boolean(accessToken);

  // Already logged in and hitting the login page → send to their home dashboard
  if (isLoggedIn && pathname === '/login') {
    const home = isAdminUser(request) ? '/admin/dashboard' : '/ops/dashboard';
    return NextResponse.redirect(new URL(home, request.url));
  }

  // Not logged in → redirect to login (preserve intended destination)
  if (!isLoggedIn && !isPublicPath(pathname)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Logged in, trying to access /admin/* but not a super admin → send to ops
  if (isLoggedIn && pathname.startsWith('/admin') && !isAdminUser(request)) {
    return NextResponse.redirect(new URL('/ops/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
