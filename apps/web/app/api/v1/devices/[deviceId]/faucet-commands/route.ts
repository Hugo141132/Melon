import { NextResponse } from 'next/server';
import {
  prisma,
  DeviceRepository,
  FaucetCommandRepository,
  FaucetCommandConflictError,
} from '@kebun-melon/database';
import {
  CreateFaucetCommandInputSchema,
  FaucetCommandQueryInputSchema,
  DeviceAccountStatus,
  DeviceConnectionStatus,
  supportsCapability,
  InvalidFaucetPhaseError,
  UserRole,
} from '@kebun-melon/contracts';
import {
  requireSession,
  requirePermission,
  requireDeviceViewAccess,
  requireDeviceControlAccess,
  AuthorizationError,
} from '@/lib/auth/rbac';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  applyRateLimitToResponse,
} from '@/lib/rate-limit';
import { validateServerEnv } from '@/lib/env/server';

export async function POST(request: Request, props: { params: Promise<{ deviceId: string }> }) {
  const params = await props.params;
  const requestId = `req-${Date.now()}`;
  const targetDeviceId = params.deviceId;

  try {
    const session = await requireSession(request);

    const env = validateServerEnv();
    const rateLimitIdentifier = session.id || getClientIp(request);
    const rateLimitInfo = checkRateLimit(rateLimitIdentifier, {
      keyPrefix: 'faucet_cmd',
      limit: env.RATE_LIMIT_FAUCET_MAX,
      windowMs: env.RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimitInfo.allowed) {
      return createRateLimitResponse(rateLimitInfo, requestId);
    }

    const body = await request.json().catch(() => ({}));
    const headerIdempotencyKey =
      request.headers.get('idempotency-key') || request.headers.get('Idempotency-Key');
    const idempotencyKey = (headerIdempotencyKey || body.idempotencyKey || '').trim();

    if (!idempotencyKey) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Idempotency-Key header or idempotencyKey property is required.',
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    }

    const deviceRepo = new DeviceRepository(prisma);
    const device = await deviceRepo.getDeviceByCanonicalId(targetDeviceId);

    if (!device) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DEVICE_NOT_FOUND',
            message: `Device '${targetDeviceId}' was not found.`,
          },
          meta: { requestId },
        },
        { status: 404 }
      );
    }

    await requireDeviceControlAccess(session, targetDeviceId, {
      isDeviceAssignedToUser: async (userId: string, devId: string) => {
        const assignment = await prisma.userDeviceAccess.findFirst({
          where: {
            userId,
            revokedAt: null,
            device: {
              OR: [{ id: devId }, { deviceId: devId }],
            },
          },
        });
        return !!assignment;
      },
      isDeviceActiveAndControllable: async () => {
        if (device.accountStatus !== DeviceAccountStatus.ACTIVE) {
          throw new AuthorizationError(
            403,
            'DEVICE_NOT_ACTIVE',
            `Device '${targetDeviceId}' is not active (status: ${device.accountStatus}).`
          );
        }

        const hasControlCap = supportsCapability(device, 'FAUCET_CONTROL');
        if (!hasControlCap) {
          throw new AuthorizationError(
            422,
            'CAPABILITY_NOT_SUPPORTED',
            `Device '${targetDeviceId}' does not support FAUCET_CONTROL capability.`
          );
        }

        if (device.connectionStatus === DeviceConnectionStatus.OFFLINE) {
          throw new AuthorizationError(
            403,
            'DEVICE_OFFLINE',
            `Device '${targetDeviceId}' is currently OFFLINE and cannot receive commands.`
          );
        }

        return true;
      },
    });

    const parseResult = CreateFaucetCommandInputSchema.safeParse({
      deviceId: device.id,
      phase: body.phase,
      idempotencyKey,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PHASE',
            message:
              'Invalid faucet phase. Allowed phases are 1 (300 mL), 2 (1,000 mL), and 3 (1,500 mL).',
            details: parseResult.error.flatten(),
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    }

    const actorRole = session.activeRoles.includes(UserRole.OWNER)
      ? UserRole.OWNER
      : UserRole.ADMIN;

    const faucetRepo = new FaucetCommandRepository(prisma);
    const command = await faucetRepo.createCommand(parseResult.data, session.id, actorRole);

    const response = NextResponse.json(
      {
        success: true,
        data: command,
        meta: { requestId },
      },
      { status: 201 }
    );
    applyRateLimitToResponse(response, rateLimitInfo);
    return response;
  } catch (error: any) {
    if (error instanceof AuthorizationError || error?.name === 'AuthorizationError') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          meta: { requestId },
        },
        { status: error.statusCode }
      );
    }

    if (error instanceof InvalidFaucetPhaseError || error?.name === 'InvalidFaucetPhaseError') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PHASE',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    }

    if (
      error instanceof FaucetCommandConflictError ||
      error?.name === 'FaucetCommandConflictError'
    ) {
      const isParamConflict = error.message.includes('Idempotency key');
      const isDeviceActiveConflict = error.message.includes('active faucet command');

      return NextResponse.json(
        {
          success: false,
          error: {
            code: isDeviceActiveConflict
              ? 'ACTIVE_COMMAND_EXISTS'
              : isParamConflict
                ? 'DUPLICATE_COMMAND_CONFLICT'
                : 'FAUCET_COMMAND_CONFLICT',
            message: error.message,
          },
          meta: { requestId },
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while creating faucet command.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, props: { params: Promise<{ deviceId: string }> }) {
  const params = await props.params;
  const requestId = `req-${Date.now()}`;
  const targetDeviceId = params.deviceId;

  try {
    const session = await requireSession(request);
    requirePermission(session, 'device.control.history.read', 'DEVICE', targetDeviceId, request);

    const env = validateServerEnv();
    const rateLimitIdentifier = session.id || getClientIp(request);
    const rateLimitInfo = checkRateLimit(rateLimitIdentifier, {
      keyPrefix: 'history',
      limit: env.RATE_LIMIT_HISTORY_MAX,
      windowMs: env.RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimitInfo.allowed) {
      return createRateLimitResponse(rateLimitInfo, requestId);
    }

    const deviceRepo = new DeviceRepository(prisma);
    const device = await deviceRepo.getDeviceByCanonicalId(targetDeviceId);

    if (!device) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DEVICE_NOT_FOUND',
            message: `Device '${targetDeviceId}' was not found.`,
          },
          meta: { requestId },
        },
        { status: 404 }
      );
    }

    await requireDeviceViewAccess(session, targetDeviceId, {
      isDeviceAssignedToUser: async (userId: string, devId: string) => {
        const assignment = await prisma.userDeviceAccess.findFirst({
          where: {
            userId,
            revokedAt: null,
            device: {
              OR: [{ id: devId }, { deviceId: devId }],
            },
          },
        });
        return !!assignment;
      },
    });

    const url = new URL(request.url);
    const rawQuery = {
      page: url.searchParams.get('page') ? Number(url.searchParams.get('page')) : 1,
      pageSize: url.searchParams.get('pageSize') ? Number(url.searchParams.get('pageSize')) : 20,
      deviceId: device.id,
      status: url.searchParams.get('status') || undefined,
      initiatedByUserId: url.searchParams.get('initiatedByUserId') || undefined,
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
      sort: url.searchParams.get('sort') || 'requestedAt:desc',
    };

    const parseResult = FaucetCommandQueryInputSchema.safeParse(rawQuery);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters for faucet commands.',
            details: parseResult.error.flatten(),
          },
          meta: { requestId },
        },
        { status: 422 }
      );
    }

    const faucetRepo = new FaucetCommandRepository(prisma);
    const result = await faucetRepo.getCommands(parseResult.data, [device.id]);

    const response = NextResponse.json(
      {
        success: true,
        data: result,
        meta: { requestId },
      },
      { status: 200 }
    );
    applyRateLimitToResponse(response, rateLimitInfo);
    return response;
  } catch (error: any) {
    if (error instanceof AuthorizationError || error?.name === 'AuthorizationError') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          meta: { requestId },
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while fetching faucet command history.',
        },
        meta: { requestId },
      },
      { status: 500 }
    );
  }
}
