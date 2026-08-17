import { requireGuestSession } from '@/lib/auth/server-guest-guard';
import LoginView from './login-view';

export default async function LoginPage() {
  await requireGuestSession('/');
  return <LoginView />;
}
