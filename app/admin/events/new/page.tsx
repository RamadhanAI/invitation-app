// app/admin/events/new/page.tsx
// app/admin/events/new/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { badgeConfigToQuery, type BadgeConfig, type BadgeTemplate, type BadgeBg } from '@/lib/badgeConfig';

type Template = { id: string; name: string; defaults: any; description?: string };

type FormState = {
  templateId: string;
  title: string;
  slug: string;
  date: string; // datetime-local
  venue: string;
  capacity: string; // string for input
  priceMajor: string; // human input (e.g. 250.00)
  currency: 'USD' | 'AED' | 'SAR';
  bannerUrl: string;
};

type PreviewState = {
  title: string;
  date: string;
  priceCents: number;
  currency: string;
  venue: string;
  bannerUrl: string;
};

type BadgeStudioState = BadgeConfig & {
  enabled: boolean; // if false, we do not send override
};

function toSlug(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parsePriceToCents(v: string) {
  const n = Number(String(v ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function isLikelyHex(v: string) {
  const s = (v || '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s);
}

const TPLS: Array<{
  key: BadgeTemplate;
  label: string;
  hint: string;
  defaultAccent: string;
  defaultBg: BadgeBg;
}> = [
  { key: 'midnight_gold', label: 'Midnight Gold', hint: 'Classic luxury', defaultAccent: '#D4AF37', defaultBg: 'dark' },
  { key: 'pearl_white', label: 'Pearl White', hint: 'Clean + premium', defaultAccent: '#0EA5E9', defaultBg: 'light' },
  { key: 'obsidian', label: 'Obsidian', hint: 'Ultra-minimal', defaultAccent: '#94A3B8', defaultBg: 'dark' },
  { key: 'emerald', label: 'Emerald', hint: 'Elite + bold', defaultAccent: '#10B981', defaultBg: 'dark' },
  { key: 'royal_blue', label: 'Royal Blue', hint: 'Corporate', defaultAccent: '#2563EB', defaultBg: 'dark' },
  { key: 'sunrise', label: 'Sunrise', hint: 'Warm + energetic', defaultAccent: '#FB7185', defaultBg: 'light' },
];

export default function NewEventPage() {
  // Steps:
  // 1) Basics
  // 2) Pricing
  // 3) Media + Badge Studio
  // 4) Review + Publish
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
    priceMajor: '',
    currency: 'USD',
    bannerUrl: '',
  });

  // Badge Studio state (per-event override payload)
  const [badge, setBadge] = useState<BadgeStudioState>({
    enabled: true,
    template: 'midnight_gold',
    accent: '#D4AF37',
    bg: 'dark',
    logoUrl: '',
    sponsorLogoUrl: '',
  });

  useEffect(() => {
    fetch('/api/templates', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    if (!form.title) return;
    setForm((f) => (f.slug ? f : { ...f, slug: toSlug(form.title) }));
  }, [form.title]);

  const preview: PreviewState = useMemo(() => {
    const priceCents = parsePriceToCents(form.priceMajor);
    return {
      title: form.title || 'Your Event Title',
      date: form.date || '',
      priceCents,
      currency: form.currency || 'USD',
      venue: form.venue || 'Venue name',
      bannerUrl: form.bannerUrl || '',
    };
  }, [form]);

  function next() {
    setStep((s) => Math.min(4, s + 1));
  }
  function back() {
    setStep((s) => Math.max(1, s - 1));
  }

  const canPublish = form.title.trim().length > 2 && form.slug.trim().length > 1 && !!form.date;

  const selectClass = 'input';
  const inputClass = 'input';

  const currencyLabel = preview.currency ?? 'USD';
  const priceLabel = preview.priceCents > 0 ? `${currencyLabel} ${(preview.priceCents / 100).toFixed(2)}` : 'Free entry';

  const isoDate = useMemo(() => {
    if (!form.date) return '';
    return form.date && !form.date.endsWith('Z') ? new Date(form.date).toISOString() : form.date;
  }, [form.date]);

  const whenWhere = useMemo(() => {
    const when = isoDate ? new Date(isoDate).toLocaleString() : '';
    const venue = (form.venue || '').trim();
    return [when, venue].filter(Boolean).join(' · ');
  }, [isoDate, form.venue]);

  // Badge preview URLs (front/back) - live render through /api/ticket/png
  const badgePreview = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const token = 'preview-token'; // safe placeholder for preview render only

    const safeCfg: BadgeConfig | null = !badge.enabled
      ? null
      : {
          template: badge.template,
          bg: badge.bg,
          accent: isLikelyHex(String(badge.accent || '').trim()) ? String(badge.accent || '').trim() : undefined,
          logoUrl: (badge.logoUrl || '').trim() || undefined,
          sponsorLogoUrl: (badge.sponsorLogoUrl || '').trim() || undefined,
        };

    const q = badgeConfigToQuery(safeCfg);

    const commonFront = new URLSearchParams({
      token,
      variant: 'front',
      width: '1200',
      dpi: '300',
      v: String(Date.now()),
      name: (form.title || 'Guest').slice(0, 60),
      title: 'Attendee',
      company: 'AurumPass',
      label: 'ATTENDEE',
      eventTitle: (form.title || 'Event').slice(0, 90),
      eventTime: whenWhere.slice(0, 120),
    });

    const commonBack = new URLSearchParams({
      token,
      variant: 'back',
      width: '1200',
      dpi: '300',
      v: String(Date.now()),
      name: (form.title || 'Guest').slice(0, 60),
      label: 'ATTENDEE',
      eventTitle: (form.title || 'Event').slice(0, 90),
      eventTime: whenWhere.slice(0, 120),
    });

    const front = `${base}/api/ticket/png?${commonFront.toString()}${q}`;
    const back = `${base}/api/ticket/png?${commonBack.toString()}${q}`;

    return { front, back };
  }, [badge, form.title, whenWhere]);

  async function publish() {
    if (!canPublish || submitting) return;
    setSubmitting(true);
    setErrMsg(null);

    try {
      const price = parsePriceToCents(form.priceMajor);

      // If badge.enabled, send a clean override payload (backend decides where to store it)
      const badgeOverride: BadgeConfig | undefined = badge.enabled
        ? {
            template: badge.template,
            bg: badge.bg,
            accent: isLikelyHex(String(badge.accent || '').trim()) ? String(badge.accent || '').trim() : undefined,
            logoUrl: (badge.logoUrl || '').trim() || undefined,
            sponsorLogoUrl: (badge.sponsorLogoUrl || '').trim() || undefined,
          }
        : undefined;

      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          slug: form.slug,
          date: isoDate,
          price,
          venue: form.venue,
          currency: form.currency,
          capacity: form.capacity ? Number(form.capacity) : null,
          description: '',
          status: 'published',
          bannerUrl: form.bannerUrl || undefined,
          templateId: form.templateId || undefined,

          // ✅ new: badge override payload
          // your backend can store per-organizer or per-event, but this gives it the data
          badge: badgeOverride,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrMsg(json?.error ?? `Create failed (${res.status})`);
        return;
      }

      window.location.href = `/admin/events/${json.event.slug}`;
    } catch (err: any) {
      setErrMsg(err?.message ?? 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Create a new event</h1>
            <p className="mt-1 text-sm text-white/60">Set it up once. Run the door like a clock.</p>
          </div>

          <div className="flex items-center gap-2">
            {([1, 2, 3, 4] as const).map((n) => (
              <span
                key={n}
                className={[
                  'text-[11px] px-2 py-1 rounded-full border',
                  step === n ? 'border-white/25 bg-white/10 text-white' : 'border-white/10 bg-black/20 text-white/55',
                ].join(' ')}
              >
                Step {n}
              </span>
            ))}
          </div>
        </div>

        {errMsg && (
          <div className="a-toast a-toast--crit">
            <div className="text-sm font-semibold">Couldn’t publish</div>
            <div className="mt-1 text-sm text-white/75">{errMsg}</div>
          </div>
        )}

        <div className="p-5 a-card">
          {/* STEP 1: BASICS */}
          {step === 1 && (
            <section className="space-y-4">
              <div>
                <label className="label">Template</label>
                <select
                  className={selectClass}
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
                <label className="label">Title</label>
                <input
                  className={inputClass}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="AI Summit Dubai"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="label">Date & time</label>
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="label">Slug</label>
                  <input
                    className={inputClass}
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: toSlug(e.target.value) }))}
                    placeholder="ai-summit-dubai"
                  />
                </div>
              </div>

              <div>
                <label className="label">Venue</label>
                <input
                  className={inputClass}
                  value={form.venue}
                  onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                  placeholder="Dubai World Trade Centre"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={next} className="a-btn a-btn--primary">
                  Continue
                </button>
                <span className="text-xs text-white/55">You can fine-tune pricing next.</span>
              </div>
            </section>
          )}

          {/* STEP 2: PRICING */}
          {step === 2 && (
            <section className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="label">Currency</label>
                  <select
                    className={selectClass}
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value as FormState['currency'] }))}
                  >
                    <option value="AED">AED (Dirham)</option>
                    <option value="SAR">SAR (Riyal)</option>
                    <option value="USD">USD (Dollar)</option>
                  </select>
                </div>

                <div>
                  <label className="label">Price</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={inputClass}
                    value={form.priceMajor}
                    onChange={(e) => setForm((f) => ({ ...f, priceMajor: e.target.value }))}
                    placeholder="0 for free"
                  />
                </div>

                <div>
                  <label className="label">Capacity (optional)</label>
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={form.capacity}
                    onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                    placeholder="e.g., 500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={back} className="a-btn a-btn--ghost">
                  Back
                </button>
                <button type="button" onClick={next} className="a-btn a-btn--primary">
                  Continue
                </button>
              </div>
            </section>
          )}

          {/* STEP 3: MEDIA + BADGE STUDIO */}
          {step === 3 && (
            <section className="space-y-5">
              <div>
                <label className="label">Banner URL (optional)</label>
                <input
                  className={inputClass}
                  value={form.bannerUrl}
                  onChange={(e) => setForm((f) => ({ ...f, bannerUrl: e.target.value }))}
                  placeholder="https://example.com/banner.jpg"
                />
              </div>

              <div className="pt-5 border-t border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Badge Studio</div>
                    <div className="mt-1 text-xs text-white/60">
                      Choose the look participants receive in emails, print pages, and PNG badge renders.
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-white/70">
                    <input
                      type="checkbox"
                      checked={badge.enabled}
                      onChange={(e) => setBadge((b) => ({ ...b, enabled: e.target.checked }))}
                    />
                    Enable override
                  </label>
                </div>

                {/* Template picker */}
                <div className={['mt-4 grid grid-cols-1 gap-3 md:grid-cols-2', !badge.enabled ? 'opacity-50 pointer-events-none' : ''].join(' ')}>
                  {TPLS.map((t) => {
                    const active = badge.template === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() =>
                          setBadge((b) => ({
                            ...b,
                            template: t.key,
                            accent: b.accent && isLikelyHex(String(b.accent)) ? b.accent : t.defaultAccent,
                            bg: t.defaultBg,
                          }))
                        }
                        className={[
                          'text-left rounded-2xl border p-4 transition',
                          active ? 'border-white/25 bg-white/10' : 'border-white/10 bg-black/20 hover:bg-white/5',
                        ].join(' ')}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-white">{t.label}</div>
                          <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 text-white/70">
                            {t.key}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-white/60">{t.hint}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Controls */}
                <div className={['mt-4 grid grid-cols-1 gap-3 md:grid-cols-3', !badge.enabled ? 'opacity-50 pointer-events-none' : ''].join(' ')}>
                  <div>
                    <label className="label">Background</label>
                    <select
                      className={selectClass}
                      value={badge.bg || 'dark'}
                      onChange={(e) => setBadge((b) => ({ ...b, bg: (e.target.value as BadgeBg) || 'dark' }))}
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Accent</label>
                    <input
                      className={inputClass}
                      value={badge.accent || ''}
                      onChange={(e) => setBadge((b) => ({ ...b, accent: e.target.value }))}
                      placeholder="#D4AF37"
                    />
                    <div className="mt-1 text-[11px] text-white/45">Use hex like #0EA5E9</div>
                  </div>

                  <div>
                    <label className="label">Logo URL (https)</label>
                    <input
                      className={inputClass}
                      value={badge.logoUrl || ''}
                      onChange={(e) => setBadge((b) => ({ ...b, logoUrl: e.target.value }))}
                      placeholder="https://…/logo.png"
                    />
                  </div>
                </div>

                <div className={['mt-3', !badge.enabled ? 'opacity-50 pointer-events-none' : ''].join(' ')}>
                  <label className="label">Sponsor Logo URL (https) — shown on back</label>
                  <input
                    className={inputClass}
                    value={badge.sponsorLogoUrl || ''}
                    onChange={(e) => setBadge((b) => ({ ...b, sponsorLogoUrl: e.target.value }))}
                    placeholder="https://…/sponsor.png"
                  />
                </div>

                {/* Preview */}
                <div className="grid grid-cols-1 gap-3 mt-4 md:grid-cols-2">
                  <div className="p-3 border rounded-2xl border-white/10 bg-black/20">
                    <div className="mb-2 text-xs text-white/60">Front preview</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={badgePreview.front}
                      alt="Front badge preview"
                      className="w-full h-auto border rounded-xl border-white/10"
                    />
                  </div>
                  <div className="p-3 border rounded-2xl border-white/10 bg-black/20">
                    <div className="mb-2 text-xs text-white/60">Back preview</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={badgePreview.back}
                      alt="Back badge preview"
                      className="w-full h-auto border rounded-xl border-white/10"
                    />
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-white/45">
                  Tip: If you’re testing on localhost and your logo URLs are http, they will be rejected by the Edge route (https-only). That’s intentional.
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={back} className="a-btn a-btn--ghost">
                  Back
                </button>
                <button type="button" onClick={next} className="a-btn a-btn--primary">
                  Continue
                </button>
              </div>
            </section>
          )}

          {/* STEP 4: REVIEW */}
          {step === 4 && (
            <section className="space-y-4">
              <div className="text-sm text-white/65">Review, then publish when ready.</div>

              <div className="p-4 space-y-2 text-sm border rounded-2xl border-white/10 bg-black/20 text-white/75">
                <div>
                  <span className="text-white/50">Title:</span> <span className="text-white">{form.title || '—'}</span>
                </div>
                <div>
                  <span className="text-white/50">Slug:</span> <span className="text-white">/e/{form.slug || '—'}</span>
                </div>
                <div>
                  <span className="text-white/50">When:</span>{' '}
                  <span className="text-white" suppressHydrationWarning>
                    {form.date ? new Date(form.date).toLocaleString() : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-white/50">Venue:</span> <span className="text-white">{form.venue || '—'}</span>
                </div>
                <div>
                  <span className="text-white/50">Price:</span> <span className="text-white">{priceLabel}</span>
                </div>
                <div>
                  <span className="text-white/50">Badge:</span>{' '}
                  <span className="text-white">
                    {badge.enabled ? `${badge.template || 'midnight_gold'} · ${badge.bg || 'dark'} · ${badge.accent || ''}` : 'Organizer default'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button type="button" onClick={back} className="a-btn a-btn--ghost">
                  Back
                </button>

                <button
                  type="button"
                  onClick={publish}
                  disabled={!canPublish || submitting}
                  className={['a-btn', 'a-btn--primary', !canPublish || submitting ? 'opacity-60 pointer-events-none' : ''].join(' ')}
                >
                  {submitting ? 'Publishing…' : 'Publish Event'}
                </button>
              </div>

              {!canPublish && <div className="text-xs text-amber-200/80">Add a title, slug, and date/time to publish.</div>}
            </section>
          )}
        </div>
      </div>

      {/* Right: Preview */}
      <div className="p-5 a-card">
        {preview.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.bannerUrl}
            alt=""
            className="object-cover w-full h-40 border rounded-2xl border-white/10"
          />
        ) : (
          <div className="grid h-40 text-sm border rounded-2xl border-white/10 bg-white/5 place-items-center text-white/50">
            Banner preview
          </div>
        )}

        <div className="mt-4 text-2xl font-semibold text-white">{preview.title}</div>

        <div className="mt-2 space-y-1 text-sm text-white/65">
          <div suppressHydrationWarning>{preview.date ? new Date(preview.date).toLocaleString() : 'Date & time'}</div>
          <div>{priceLabel}</div>
          <div>{preview.venue}</div>
        </div>

        <div className="mt-5 text-xs text-white/45">
          Public link: <span className="text-white/70">/e/{form.slug || 'your-slug'}</span>
        </div>

        {/* Badge preview (small) */}
        <div className="p-3 mt-5 border rounded-2xl border-white/10 bg-black/20">
          <div className="mb-2 text-xs text-white/60">Badge snapshot</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={badgePreview.front}
            alt="Badge snapshot"
            className="w-full h-auto border rounded-xl border-white/10"
          />
        </div>
      </div>
    </div>
  );
}
