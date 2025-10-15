// Proxies attendance stats with server-side admin key
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE  = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ADMIN = process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const target = `${BASE}/api/events/${encodeURIComponent(params.slug)}/attendance`;
  const resp = await fetch(target, { headers: { 'x-api-key': ADMIN }, cache: 'no-store' });
  return new Response(resp.body, { status: resp.status, headers: resp.headers });
}
