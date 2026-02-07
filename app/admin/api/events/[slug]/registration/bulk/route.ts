// Server proxy that forwards to the secured API and injects ADMIN_KEY
// app/admin/api/events/[slug]/registration/bulk/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function originFrom(req: Request) {
  return new URL(req.url).origin;
}

async function forward(req: Request, slug: string) {
  const target = `${originFrom(req)}/api/admin/events/${encodeURIComponent(slug)}/registration/bulk`;

  const resp = await fetch(target, {
    method: req.method,
    headers: {
      'content-type': req.headers.get('content-type') || 'application/json',
      cookie: req.headers.get('cookie') ?? '',
    },
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text(),
    cache: 'no-store',
  });

  return new Response(await resp.text(), {
    status: resp.status,
    headers: { 'content-type': resp.headers.get('content-type') || 'application/json' },
  });
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  return forward(req, params.slug);
}
export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  return forward(req, params.slug);
}
