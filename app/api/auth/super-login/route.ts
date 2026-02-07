// app/api/auth/super-login/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const form = await req.formData();

  // Default next to super admin area
  if (!form.get('next')) form.set('next', '/admin/tenants');

  // Repost to the unified login route
  const url = new URL('/api/auth/login', req.url);

  // Must rebuild a Request with same cookies/headers? Not needed; we just redirect client to use /api/auth/login.
  // Easiest: client form should POST directly to /api/auth/login.
  // But if you want to keep this endpoint, we redirect with 307 to preserve POST.
  const redirectTo = new URL('/api/auth/login', req.url);
  redirectTo.searchParams.set('next', String(form.get('next') || '/admin/tenants'));

  // NOTE: a redirect won’t carry form body automatically in browsers.
  // So: the proper solution is: make the Super Login UI POST directly to /api/auth/login.
  return NextResponse.redirect(new URL('/super/login?err=0', req.url), { status: 303 });
}
