import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, validateSession, SESSION_COOKIE_NAME } from '@kebun-melon/database';

function extractSessionToken(request: Request): string | undefined {
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(
      new RegExp(`(?:^|; )\\s*${SESSION_COOKIE_NAME}\\s*=\\s*([^;]+)`)
    );
    if (match && match[1]) {
      return match[1];
    }
  }
  try {
    const cookieStore = cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    return undefined;
  }
}

export async function GET(request: Request) {
  const requestId = `req-${Date.now()}`;

  try {
    const token = extractSessionToken(request);

    if (!token) {
      return NextResponse.json(
        {
          success: true,
          data: {
            authenticated: false,
            user: null,
          },
          meta: { requestId },
        },
        { status: 200 }
      );
    }

    const sessionInfo = await validateSession(prisma, token);

    if (!sessionInfo) {
      const response = NextResponse.json(
        {
          success: true,
          data: {
            authenticated: false,
            user: null,
          },
          meta: { requestId },
        },
        { status: 200 }
      );

      response.cookies.set(SESSION_COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 0,
      });

      return response;
    }

    const primaryRole = sessionInfo.user.activeRoles[0] ?? 'ADMIN';

    return NextResponse.json(
      {
        success: true,
        data: {
          authenticated: true,
          user: {
            id: sessionInfo.user.id,
            fullName: sessionInfo.user.fullName,
            email: sessionInfo.user.email,
            role: primaryRole,
            accountStatus: sessionInfo.user.accountStatus,
            preferredLocale: 'id',
          },
        },
        meta: { requestId },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected internal error occurred while retrieving session.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
