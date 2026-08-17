import { requireGuestSession } from '@/lib/auth/server-guest-guard';
import RegisterView from './register-view';

export default async function RegisterPage() {
  await requireGuestSession('/');
  return <RegisterView />;
}
