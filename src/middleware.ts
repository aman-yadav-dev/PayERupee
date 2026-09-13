import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function applySecurityHeaders(res: NextResponse) {
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  return res;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Structural API-key validation for /api/v1/payouts
  if (pathname.startsWith('/api/v1/payouts')) {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return applySecurityHeaders(
        NextResponse.json({ success: false, error: 'Missing Authorization header' }, { status: 401 })
      );
    }

    if (!authHeader.startsWith('Bearer ')) {
      return applySecurityHeaders(
        NextResponse.json({ success: false, error: 'Invalid Authorization format' }, { status: 401 })
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (token.length === 0) {
      return applySecurityHeaders(
        NextResponse.json({ success: false, error: 'Empty Bearer value' }, { status: 401 })
      );
    }
  }

  // 2. Continue the request and apply headers
  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
