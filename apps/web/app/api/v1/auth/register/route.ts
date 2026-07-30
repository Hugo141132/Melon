import { NextResponse } from 'next/server';
import { prisma } from '@kebun-melon/database';
import {
  registerUser,
  DuplicateEmailError,
  PasswordPolicyError,
  MissingRoleError,
  OwnerAlreadyExistsError,
} from '@kebun-melon/database';
import { ZodError } from 'zod';

export async function POST(request: Request) {
  const requestId = `req-${Date.now()}`;

  try {
    const body = await request.json();
    const result = await registerUser(prisma, body);

    return NextResponse.json(
      {
        success: true,
        data: {
          user: result.user,
        },
        meta: {
          requestId,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request payload format or extraneous fields present.',
            details: error.flatten(),
          },
          meta: { requestId },
        },
        { status: 400 }
      );
    }

    if (error instanceof OwnerAlreadyExistsError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'OWNER_ALREADY_EXISTS',
            message: 'Akun Owner sudah terdaftar di sistem. Pendaftaran Owner tidak tersedia.',
          },
          meta: { requestId },
        },
        { status: 409 }
      );
    }

    if (error instanceof DuplicateEmailError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_EMAIL',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 409 }
      );
    }

    if (error instanceof PasswordPolicyError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PASSWORD_POLICY_FAILED',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    }

    if (error instanceof MissingRoleError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'System role configuration error. Please contact system administrator.',
          },
          meta: { requestId },
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected internal error occurred during registration.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
