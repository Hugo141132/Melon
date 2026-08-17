import { requireGuestSession } from '@/lib/auth/server-guest-guard';
import ResetPasswordView from './reset-password-view';

export default async function ResetPasswordPage() {
  await requireGuestSession('/');
  return <ResetPasswordView />;
}
