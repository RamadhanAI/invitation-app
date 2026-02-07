import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';

const COOKIE_NAME = 'scan_sess';

/**
 * Reads the station-scanner session cookie (set by /api/scanner/session)
 */
export async function getScannerSession() {
  const tokenCookie = cookies().get(COOKIE_NAME)?.value || '';
  const sess = verifySession(tokenCookie || undefined);
  return sess || null;
}
