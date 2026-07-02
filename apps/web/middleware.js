import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Public routes - no auth required
  if (
    pathname === '/' ||
    pathname.startsWith('/catalogue') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/verify-email') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/about') ||
    pathname.startsWith('/contact') ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/trade-terms') ||
    pathname.startsWith('/help-centre') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  // Check for session cookie
  const refreshToken = request.cookies.get('refreshToken');
  if (!refreshToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based routing (client-side will enforce; middleware is coarse)
  if (pathname.startsWith('/buyer')) {
    // Will be validated client-side for TRADE_BUYER + APPROVED
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/inventory')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/finance')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/delivery')) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
