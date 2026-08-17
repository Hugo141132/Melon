import { requireGuestSession } from '@/lib/auth/server-guest-guard';
import ForgotPasswordView from './forgot-password-view';

export default async function ForgotPasswordPage() {
  await requireGuestSession('/');
  return <ForgotPasswordView />;
}
