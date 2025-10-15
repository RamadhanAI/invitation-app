// lib/rateLimit.ts
type Key = string;
const hits = new Map<Key, number[]>();

export function rateLimit(opts: { key: string; limit: number; windowMs: number }) {
  const now = Date.now();
  const start = now - opts.windowMs;
  const arr = hits.get(opts.key) || [];
  const recent = arr.filter(ts => ts > start);
  recent.push(now);
  hits.set(opts.key, recent);
  return { ok: recent.length <= opts.limit, count: recent.length };
}

export function ipKey(req: Request, bucket: string) {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = fwd || 'local';
  return `${bucket}:${ip}`;
}
