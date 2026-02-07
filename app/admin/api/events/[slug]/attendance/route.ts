// Proxies attendance stats with server-side admin key
// app/admin/api/events/[slug]/attendance/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function originFrom(req: Request) {
  return new URL(req.url).origin;
}

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const target = `${originFrom(req)}/api/admin/events/${encodeURIComponent(params.slug)}/attendance`;

  const resp = await fetch(target, {
    headers: {
      // ✅ forward cookies so /api/admin can read the session
      cookie: req.headers.get('cookie') ?? '',
    },
    cache: 'no-store',
  });

  return new Response(await resp.text(), {
    status: resp.status,
    headers: { 'content-type': resp.headers.get('content-type') ?? 'application/json' },
  });
}
