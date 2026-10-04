import { requireGuestSession } from '@/lib/auth/server-guest-guard';
import LoginView from './login-view';

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const isOutageRecovery = params?.reason === 'outage';

  // In outage recovery, bypass requireGuestSession('/') so the login screen renders
  // without silently restoring the old session. Session invalidation and cookie clearing
  // are handled via client-driven POST /api/v1/auth/logout mutation in LoginView.
  if (!isOutageRecovery) {
    await requireGuestSession('/');
  }

  return <LoginView />;
}
