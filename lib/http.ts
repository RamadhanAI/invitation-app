// lib/http.ts
export async function internalJson<T>(path: string, init: RequestInit = {}) {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { accept: 'application/json', ...(init.headers || {}) },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
    return (await res.json()) as T;
  }
  