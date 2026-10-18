import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get('session')?.value;

  // Authenticated users visiting login/register → redirect to dashboard
  if (session && PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Unauthenticated users visiting protected routes → redirect to login
  if (!session && !PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api routes (handled by their own auth)
     * - _next (static files, images, etc.)
     * - favicon, public assets
     */
    '/((?!api|_next|favicon.ico|.*\\.).*)',
  ],
};
