import { NextResponse } from 'next/server';
import { prisma } from '@kebun-melon/database';
import { isOwnerRegistrationAvailable } from '@kebun-melon/database';

export async function GET() {
  const requestId = `req-${Date.now()}`;
  try {
    const ownerAvailable = await isOwnerRegistrationAvailable(prisma);

    return NextResponse.json(
      {
        success: true,
        data: {
          ownerRegistrationAvailable: ownerAvailable,
        },
        meta: {
          requestId,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch registration capabilities.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
