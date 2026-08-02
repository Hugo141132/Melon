import { NextRequest } from 'next/server';
import { UserRole, AccountStatus } from '@kebun-melon/contracts';

export interface MockApiSessionOptions {
  userId?: string;
  email?: string;
  fullName?: string;
  role?: UserRole;
  accountStatus?: AccountStatus;
  sessionToken?: string;
}

export function createMockApiRequest(options: {
  url?: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
}): NextRequest {
  const url = options.url ?? 'http://localhost:3000/api/v1/health';
  const method = options.method ?? 'GET';
  const headers = new Headers(options.headers);

  if (options.body && typeof options.body === 'object') {
    headers.set('content-type', 'application/json');
  }

  const request = new NextRequest(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (options.cookies) {
    Object.entries(options.cookies).forEach(([key, val]) => {
      request.cookies.set(key, val);
    });
  }

  return request;
}

export function createMockAuthenticatedSession(overrides?: MockApiSessionOptions) {
  const userId = overrides?.userId ?? `user-${Math.random().toString(36).substring(2, 9)}`;
  return {
    userId,
    email: overrides?.email ?? `${userId}@kebunmelon.local`,
    fullName: overrides?.fullName ?? 'Test Admin',
    role: overrides?.role ?? UserRole.ADMIN,
    accountStatus: overrides?.accountStatus ?? AccountStatus.ACTIVE,
    sessionToken: overrides?.sessionToken ?? `session-token-${userId}`,
  };
}

export async function parseApiResponseEnvelope<T = unknown>(
  response: Response
): Promise<{
  status: number;
  body: T;
}> {
  const body = (await response.json()) as T;
  return {
    status: response.status,
    body,
  };
}
