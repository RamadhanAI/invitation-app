// Server proxy that forwards to the secured API and injects ADMIN_KEY
// app/admin/api/events/[slug]/registration/bulk/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE  = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ADMIN = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();

async function forward(req: Request, slug: string) {
  if (!ADMIN) return new Response(JSON.stringify({ error: 'ADMIN_KEY not set' }), { status: 500 });
  const target = `${BASE}/api/events/${encodeURIComponent(slug)}/registration/bulk`;
  const resp = await fetch(target, {
    method: req.method,
    headers: { 'x-api-key': ADMIN, authorization: `Bearer ${ADMIN}`, 'content-type': req.headers.get('content-type') || 'application/json' },
    body: ['GET','HEAD'].includes(req.method) ? undefined : await req.text(),
    cache: 'no-store',
  });
  return new Response(await resp.text(), { status: resp.status, headers: { 'content-type': resp.headers.get('content-type') || 'application/json' } });
}
export async function POST(req: Request, { params }: { params: { slug: string } }) { return forward(req, params.slug); }
export async function PATCH(req: Request, { params }: { params: { slug: string } }) { return forward(req, params.slug); }
