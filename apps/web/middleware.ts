import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'session_token';

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/status',
  '/health',
  '/ready',
  '/api/v1/auth/',
  '/api/v1/internal/',
];

/**
 * Helper to identify device telemetry ingestion paths (e.g. /api/v1/devices/[deviceId]/telemetry/soil).
 * Device telemetry endpoints use device-level authentication (e.g. X-Device-Id header), not user session cookies.
 */
function isDeviceTelemetryIngestionPath(pathname: string): boolean {
  return /^\/api\/v1\/devices\/[^\/]+\/telemetry(\/.*)?$/.test(pathname);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );

  const isDeviceTelemetry = isDeviceTelemetryIngestionPath(pathname);

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!isPublic && !isDeviceTelemetry && !token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication session is required to perform this action.',
          },
        },
        { status: 401 }
      );
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
