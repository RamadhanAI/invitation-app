// app/admin/events/[slug]/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EditEventPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', slug: params.slug, date: '', price: 0, currency: 'USD',
    venue: '', capacity: '', description: '', status: 'published'
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(`/api/events?slug=${encodeURIComponent(params.slug)}`, { cache: 'no-store' });
        const j = await r.json();
        const ev = j?.events?.find((e: any) => e.slug === params.slug);
        if (alive && ev) {
          setForm(f => ({
            ...f,
            title: ev.title,
            slug: ev.slug,
            date: ev.date ? new Date(ev.date).toISOString().slice(0,16) : '',
            price: ev.price ?? 0,
            currency: ev.currency ?? 'USD',
            venue: ev.venue ?? '',
            // capacity/description/status not in that GET select; leave as-is if unknown
          }));
        }
      } catch (e: any) { if (alive) setErr('Failed to load event'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [params.slug]);

  async function save() {
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(params.slug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          date: form.date ? new Date(form.date).toISOString() : undefined,
          capacity: form.capacity ? Number(form.capacity) : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Save failed');
      // navigate to new slug if changed
      const nextSlug = json.event.slug;
      router.push(`/admin/events/${encodeURIComponent(nextSlug)}`);
    } catch (e: any) {
      setErr(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 a-card">Loading…</div>;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="p-4 a-card">
        <div className="text-xl font-semibold">Edit event</div>
        {err && <div className="mt-2 text-red-400">{err}</div>}
      </div>

      <div className="grid gap-3 p-4 a-card">
        <input className="a-input" placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} />
        <input className="a-input" placeholder="Slug"  value={form.slug}  onChange={e=>setForm({...form,slug:e.target.value})} />
        <input className="a-input" type="datetime-local" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
        <div className="grid grid-cols-3 gap-2">
          <input className="a-input" placeholder="Price" value={form.price} onChange={e=>setForm({...form,price:Number(e.target.value||0)})} />
          <input className="a-input" placeholder="Currency" value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})} />
          <input className="a-input" placeholder="Capacity" value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})} />
        </div>
        <input className="a-input" placeholder="Venue" value={form.venue} onChange={e=>setForm({...form,venue:e.target.value})} />
        <textarea className="a-input" rows={5} placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} />
        <div className="flex gap-2">
          <select className="a-input" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
          <button className="a-btn a-btn--primary" onClick={save} disabled={saving}>{saving?'Saving…':'Save'}</button>
        </div>
      </div>
    </div>
  );
}
