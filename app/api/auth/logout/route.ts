// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  await clearSession('admin');
  await clearSession('scanner');
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
}
