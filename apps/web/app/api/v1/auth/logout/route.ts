import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, revokeSession, SESSION_COOKIE_NAME } from '@kebun-melon/database';

async function extractSessionToken(request: Request): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) return token;
  } catch (err) {
    // Fallback if cookies() throws (e.g., outside App Router context in some tests)
  }

  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(
      new RegExp(`(?:^|; )\\s*${SESSION_COOKIE_NAME}\\s*=\\s*([^;]+)`)
    );
    if (match && match[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
  }

  return undefined;
}

export async function POST(request: Request) {
  const requestId = `req-${Date.now()}`;

  try {
    const token = await extractSessionToken(request);

    if (token) {
      await revokeSession(prisma, token, { requestId });
    }

    const response = new NextResponse(null, { status: 204 });

    response.cookies.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('[Logout Route Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected internal error occurred during logout.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
