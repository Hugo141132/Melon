import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Public Liveness Endpoint per docs/API.md §24.1
 * Returns 200 OK as long as the web process is running.
 * Liveness should not fail merely because an external dependency is temporarily unavailable.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
    },
    { status: 200 }
  );
}
