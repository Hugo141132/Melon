import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, revokeSession, SESSION_COOKIE_NAME } from '@kebun-melon/database';

async function extractSessionToken(request: Request): Promise<string | undefined> {
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
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    return undefined;
  }
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
    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    return response;
  }
}
