import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE } from '@/lib/config';
import { isTokenUsable } from '@/lib/jwt';

/** Root entry: route to the dashboard when a session exists, else to login. */
export default async function RootPage(): Promise<never> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  redirect(isTokenUsable(token) ? '/dashboard' : '/login');
}
