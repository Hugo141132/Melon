import { requireGuestSession } from '@/lib/auth/server-guest-guard';
import VerifyEmailView from './verify-email-view';

export default async function VerifyEmailPage() {
  await requireGuestSession('/');
  return <VerifyEmailView />;
}
