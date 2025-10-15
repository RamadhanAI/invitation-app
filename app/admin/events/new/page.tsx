// app/admin/events/new/page.tsx
// app/admin/events/new/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type Template = { id: string; name: string; defaults: any; description?: string };

type FormState = {
  templateId: string;
  title: string;
  slug: string;
  date: string;      // datetime-local
  venue: string;
  capacity: string;  // keep as string for input, cast later
  price: number;     // cents
  currency: 'USD' | 'AED' | 'SAR';
  bannerUrl: string;
};

type PreviewState = {
  title: string;
  date: string;      // NOTE: no server-side "now" fallback to avoid hydration drift
  price: number;
  currency: string;
  venue: string;
  bannerUrl: string;
};

export default function NewEventPage() {
  const [step, setStep] = useState<number>(1);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    templateId: '',
    title: '',
    slug: '',
    date: '',
    venue: '',
    capacity: '',
    price: 0,
    currency: 'USD',
    bannerUrl: '',
  });

  useEffect(() => {
    fetch('/api/templates', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => setTemplates([]));
  }, []);

  // Auto-generate slug from title once
  useEffect(() => {
    if (!form.title) return;
    setForm((f) => {
      if (f.slug) return f;
      const s = form.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      return { ...f, slug: s };
    });
  }, [form.title]);

  const preview: PreviewState = useMemo(
    () => ({
      title: form.title || 'Your Event Title',
      // ✅ no "now" fallback here — keeps SSR/CSR in sync
      date: form.date || '',
      price: Number.isFinite(form.price) ? form.price : 0,
      currency: form.currency || 'USD',
      venue: form.venue || 'Venue name',
      bannerUrl: form.bannerUrl || '',
    }),
    [form]
  );

  function next() { setStep((s) => Math.min(4, s + 1)); }
  function back() { setStep((s) => Math.max(1, s - 1)); }

  const canPublish =
    form.title.trim().length > 2 &&
    form.slug.trim().length > 1 &&
    !!form.date; // datetime-local string

  async function publish() {
    if (!canPublish || submitting) return;
    setSubmitting(true); setErrMsg(null);

    // Convert datetime-local to ISO if needed
    const isoDate = form.date && !form.date.endsWith('Z')
      ? new Date(form.date).toISOString()
      : form.date;

    try {
      // ⬅️ Call the secure proxy so ADMIN_KEY stays server-side
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          slug: form.slug,
          date: isoDate,
          price: Number(form.price) || 0,
          venue: form.venue,
          currency: form.currency,
          capacity: form.capacity ? Number(form.capacity) : null,
          description: '',
          status: 'published',
          bannerUrl: form.bannerUrl || undefined,
          templateId: form.templateId || undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrMsg(json?.error ?? `Create failed (${res.status})`);
        return;
      }
      window.location.href = `/admin/${json.event.slug}`;
    } catch (err: any) {
      setErrMsg(err?.message ?? 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  const currencySymbol = { AED: 'AED', SAR: 'SAR', USD: 'USD' }[preview.currency] ?? preview.currency;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left: Wizard Form */}
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Create a new event</h1>

        {errMsg && (
          <div className="p-2 text-sm text-red-700 border border-red-200 rounded bg-red-50">
            {errMsg}
          </div>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <div>
              <label className="block mb-1 text-sm">Template</label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={form.templateId}
                onChange={(e) => setForm((f) => ({ ...f, templateId: e.target.value }))}
              >
                <option value="">(None)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 text-sm">Title</label>
              <input
                className="w-full px-3 py-2 border rounded"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="AI Summit Dubai"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 text-sm">Date & time</label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 border rounded"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm">Slug</label>
                <input
                  className="w-full px-3 py-2 border rounded"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="ai-summit-dubai"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1 text-sm">Venue</label>
              <input
                className="w-full px-3 py-2 border rounded"
                value={form.venue}
                onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                placeholder="Dubai World Trade Centre"
              />
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={next} className="px-4 py-2 text-white bg-black rounded">
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block mb-1 text-sm">Currency</label>
                <select
                  className="w-full px-3 py-2 border rounded"
                  value={form.currency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currency: e.target.value as FormState['currency'] }))
                  }
                >
                  <option value="AED">AED (United Arab Emirates Dirham)</option>
                  <option value="SAR">SAR (Saudi Riyal)</option>
                  <option value="USD">USD (US Dollar)</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-sm">Price (in cents)</label>
                <input
                  type="number"
                  min={0}
                  className="w-full px-3 py-2 border rounded"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value || 0) }))}
                  placeholder="0 for free"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm">Capacity (optional)</label>
                <input
                  type="number"
                  min={0}
                  className="w-full px-3 py-2 border rounded"
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                  placeholder="e.g., 500"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={back} className="px-4 py-2 border rounded">
                Back
              </button>
              <button type="button" onClick={next} className="px-4 py-2 text-white bg-black rounded">
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <div>
              <label className="block mb-1 text-sm">Banner URL (optional)</label>
              <input
                className="w-full px-3 py-2 border rounded"
                value={form.bannerUrl}
                onChange={(e) => setForm((f) => ({ ...f, bannerUrl: e.target.value }))}
                placeholder="https://example.com/banner.jpg"
              />
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={back} className="px-4 py-2 border rounded">
                Back
              </button>
              <button type="button" onClick={next} className="px-4 py-2 text-white bg-black rounded">
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <div className="text-sm text-gray-600">Review and publish your event.</div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={back} className="px-4 py-2 border rounded">
                Back
              </button>
              <button
                type="button"
                onClick={publish}
                disabled={!canPublish || submitting}
                className={`px-4 py-2 rounded text-white ${!canPublish || submitting ? 'bg-gray-400' : 'bg-green-600'}`}
              >
                {submitting ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Right: Live preview */}
      <div className="p-4 space-y-2 border rounded">
        {preview.bannerUrl && (
          <img src={preview.bannerUrl} alt="" className="object-cover w-full h-40 rounded" />
        )}
        <div className="text-2xl font-semibold">{preview.title}</div>
        <div className="text-sm text-gray-600" suppressHydrationWarning>
          {preview.date ? new Date(preview.date).toLocaleString() : 'Date & time'}
        </div>
        <div className="text-sm text-gray-600">
          {preview.price > 0
            ? `${currencySymbol} ${(preview.price / 100).toFixed(2)}`
            : 'Free entry'}
        </div>
        <div className="text-sm text-gray-600">{preview.venue}</div>
        <div className="mt-4 text-xs text-gray-400">Public URL: /e/{form.slug || 'your-slug'}</div>
      </div>
    </div>
  );
}
