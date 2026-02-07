// app/admin/brand/page.tsx
// app/admin/brand/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import ColorPicker from '@/components/form/ColorPicker';

const TEMPLATES = [
  { id: 'midnight_gold', label: 'Midnight Gold (default)' },
  { id: 'pearl_white', label: 'Pearl White' },
  { id: 'obsidian', label: 'Obsidian' },
  { id: 'emerald', label: 'Emerald' },
  { id: 'royal_blue', label: 'Royal Blue' },
  { id: 'sunrise', label: 'Sunrise' },
];

type Sess = { ok?: boolean; role?: string; oid?: string | null };
type OrganizerLite = { id: string; name: string; email: string; status?: string };
type EventLite = { id: string; slug: string; title: string; date: string; status?: string };

function isObj(v: any): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function safeHttps(v: string) {
  const s = (v || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
}

function safeHex(v: string) {
  const s = (v || '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) ? s : '';
}

function field(): React.CSSProperties {
  return { width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' };
}
function btnPrimary(): React.CSSProperties {
  return { padding: '10px 12px', borderRadius: 10, background: '#0f172a', color: '#fff', fontWeight: 700 };
}
function btnGhost(): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 10,
    background: '#fff',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    fontWeight: 700,
  };
}

export default function BrandStudioPage() {
  const [sess, setSess] = useState<Sess | null>(null);
  const [authError, setAuthError] = useState<string>('');

  const [organizers, setOrganizers] = useState<OrganizerLite[]>([]);
  const [organizerId, setOrganizerId] = useState('');
  const [events, setEvents] = useState<EventLite[]>([]);
  const [brand, setBrand] = useState<Record<string, any>>({});
  const [raw, setRaw] = useState('');
  const [status, setStatus] = useState<string>('');

  // Default badge editor
  const [tpl, setTpl] = useState('midnight_gold');
  const [bg, setBg] = useState<'dark' | 'light'>('dark');
  const [accent, setAccent] = useState('#D4AF37');
  const [logoUrl, setLogoUrl] = useState('');
  const [sponsorLogoUrl, setSponsorLogoUrl] = useState('');

  // Event override editor
  const [eventSlug, setEventSlug] = useState('');
  const [etpl, setEtpl] = useState('midnight_gold');
  const [ebg, setEbg] = useState<'dark' | 'light'>('dark');
  const [eaccent, setEaccent] = useState('#0EA5E9');
  const [elogoUrl, setElogoUrl] = useState('');
  const [esponsorLogoUrl, setEsponsorLogoUrl] = useState('');

  const headers = useMemo(() => ({ 'content-type': 'application/json' }), []);

  async function apiGet(url: string) {
    const r = await fetch(url, { headers, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || (j && j.ok === false)) throw new Error(j?.error || `Request failed (${r.status})`);
    return j;
  }

  async function apiPatch(url: string, body: any) {
    const r = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || (j && j.ok === false)) throw new Error(j?.error || `Request failed (${r.status})`);
    return j;
  }

  // 1) Session
  useEffect(() => {
    setAuthError('');
    fetch('/api/admin/session', { cache: 'no-store' })
      .then((r) => r.json().then((j) => ({ r, j })))
      .then(({ r, j }) => {
        if (!r.ok || !j?.ok) throw new Error(j?.error || 'Unauthorized');
        setSess({ ok: true, role: String(j.role || ''), oid: j.oid ?? null });
      })
      .catch((e) => setAuthError(String(e?.message || e)));
  }, []);

  const role = String(sess?.role || '');
  const isSuper = role === 'superadmin';
  const isTenant = !!role && role !== 'superadmin';

  // 2) Superadmin: load organizers list
  useEffect(() => {
    if (!role) return;
    if (!isSuper) return;

    setStatus('Loading organizers…');
    apiGet('/api/admin/brand')
      .then((j) => {
        setOrganizers(j.organizers || []);
        if (!organizerId && (j.organizers?.[0]?.id || '')) setOrganizerId(j.organizers[0].id);
        setStatus('');
      })
      .catch((e) => setStatus(String(e?.message || e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // 2b) Tenant: lock organizerId to session oid
  useEffect(() => {
    if (!role) return;
    if (!isTenant) return;
    if (!sess?.oid) return;
    setOrganizerId(sess.oid);
  }, [role, isTenant, sess?.oid]);

  // 3) Load brand + events
  useEffect(() => {
    if (!role) return;

    setStatus('Loading brand + events…');

    // Superadmin uses organizerId param; tenant can omit organizerId (API should infer from session)
    const url =
      isSuper && organizerId
        ? `/api/admin/brand?organizerId=${encodeURIComponent(organizerId)}`
        : `/api/admin/brand`;

    apiGet(url)
      .then((j) => {
        const b = isObj(j.brand) ? j.brand : {};
        setBrand(b);
        setRaw(JSON.stringify(b, null, 2));

        const evs = (j.events || []) as EventLite[];
        setEvents(evs);

        // hydrate default badge editor
        const d = isObj(b.badge) ? b.badge : {};
        setTpl(typeof d.template === 'string' ? d.template : 'midnight_gold');
        setBg(d.bg === 'light' ? 'light' : 'dark');
        setAccent(safeHex(String(d.accent || '')) || '#D4AF37');
        setLogoUrl(String(d.logoUrl || b.logoUrl || ''));
        setSponsorLogoUrl(String(d.sponsorLogoUrl || b.sponsorLogoUrl || ''));

        const first = evs?.[0]?.slug || '';
        setEventSlug(first);

        if (first && isObj(b.events) && isObj(b.events[first]) && isObj(b.events[first].badge)) {
          const ob = b.events[first].badge;
          setEtpl(typeof ob.template === 'string' ? ob.template : 'midnight_gold');
          setEbg(ob.bg === 'light' ? 'light' : 'dark');
          setEaccent(safeHex(String(ob.accent || '')) || '#0EA5E9');
          setElogoUrl(String(ob.logoUrl || ''));
          setEsponsorLogoUrl(String(ob.sponsorLogoUrl || ''));
        } else {
          setEtpl('midnight_gold');
          setEbg('dark');
          setEaccent('#0EA5E9');
          setElogoUrl('');
          setEsponsorLogoUrl('');
        }

        setStatus('');
      })
      .catch((e) => setStatus(String(e?.message || e)));
  }, [role, isSuper, organizerId]);

  // when eventSlug changes, hydrate override editor from saved brand values
  useEffect(() => {
    if (!eventSlug) return;
    if (!isObj(brand.events) || !isObj(brand.events[eventSlug]) || !isObj(brand.events[eventSlug].badge)) {
      setEtpl('midnight_gold');
      setEbg('dark');
      setEaccent('#0EA5E9');
      setElogoUrl('');
      setEsponsorLogoUrl('');
      return;
    }
    const ob = brand.events[eventSlug].badge;
    setEtpl(typeof ob.template === 'string' ? ob.template : 'midnight_gold');
    setEbg(ob.bg === 'light' ? 'light' : 'dark');
    setEaccent(safeHex(String(ob.accent || '')) || '#0EA5E9');
    setElogoUrl(String(ob.logoUrl || ''));
    setEsponsorLogoUrl(String(ob.sponsorLogoUrl || ''));
  }, [eventSlug, brand]);

  function previewUrl(opts: {
    template: string;
    bg: string;
    accent: string;
    logoUrl?: string;
    sponsorLogoUrl?: string;
    variant: 'front' | 'back';
  }) {
    const p = new URLSearchParams({
      token: 'demo-token',
      variant: opts.variant,
      width: '1200',
      dpi: '300',
      name: 'Demo Guest',
      title: 'Director',
      company: 'AurumPass',
      label: 'VIP',
      eventTitle: 'Demo Event',
      eventTime: new Date().toLocaleString(),
      template: opts.template,
      bg: opts.bg,
      accent: opts.accent,
    });

    if (opts.logoUrl) p.set('logoUrl', safeHttps(opts.logoUrl));
    if (opts.sponsorLogoUrl) p.set('sponsorLogoUrl', safeHttps(opts.sponsorLogoUrl));

    return `/api/ticket/png?${p.toString()}`;
  }

  async function saveDefaultBadge() {
    const cleanAccent = safeHex(accent) || '';
    const cleanLogo = safeHttps(logoUrl);
    const cleanSponsor = safeHttps(sponsorLogoUrl);

    const patch: any = {
      badge: {
        template: tpl,
        bg,
        ...(cleanAccent ? { accent: cleanAccent } : {}),
        ...(cleanLogo ? { logoUrl: cleanLogo } : {}),
        ...(cleanSponsor ? { sponsorLogoUrl: cleanSponsor } : {}),
      },
      ...(cleanLogo ? { logoUrl: cleanLogo } : {}),
      ...(cleanSponsor ? { sponsorLogoUrl: cleanSponsor } : {}),
    };

    setStatus('Saving default badge…');
    try {
      const body = isSuper ? { organizerId, patch } : { patch };
      const j = await apiPatch('/api/admin/brand', body);
      setBrand(j.brand || {});
      setRaw(JSON.stringify(j.brand || {}, null, 2));
      setStatus('✅ Saved');
      setTimeout(() => setStatus(''), 1200);
    } catch (e: any) {
      setStatus(String(e?.message || e));
    }
  }

  async function saveEventOverride() {
    if (!eventSlug) return;

    const cleanAccent = safeHex(eaccent) || '';
    const cleanLogo = safeHttps(elogoUrl);
    const cleanSponsor = safeHttps(esponsorLogoUrl);

    const badge: any = {
      template: etpl,
      bg: ebg,
      ...(cleanAccent ? { accent: cleanAccent } : {}),
      ...(cleanLogo ? { logoUrl: cleanLogo } : {}),
      ...(cleanSponsor ? { sponsorLogoUrl: cleanSponsor } : {}),
    };

    setStatus(`Saving override for ${eventSlug}…`);
    try {
      const body = isSuper ? { organizerId, eventSlug, badge } : { eventSlug, badge };
      const j = await apiPatch('/api/admin/brand', body);
      setBrand(j.brand || {});
      setRaw(JSON.stringify(j.brand || {}, null, 2));
      setStatus('✅ Saved');
      setTimeout(() => setStatus(''), 1200);
    } catch (e: any) {
      setStatus(String(e?.message || e));
    }
  }

  async function saveRawBrand() {
    setStatus('Saving raw brand JSON…');
    try {
      const parsed = JSON.parse(raw || '{}');
      const body = isSuper ? { organizerId, brand: parsed } : { brand: parsed };
      const j = await apiPatch('/api/admin/brand', body);
      setBrand(j.brand || {});
      setRaw(JSON.stringify(j.brand || {}, null, 2));
      setStatus('✅ Saved');
      setTimeout(() => setStatus(''), 1200);
    } catch (e: any) {
      setStatus(String(e?.message || e));
    }
  }

  if (authError) {
    return (
      <main style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Badge Studio</h1>
        <p style={{ marginTop: 10, color: '#b91c1c' }}>{authError}</p>
        <p style={{ marginTop: 6, color: '#64748b' }}>
          Please sign in at <code>/login</code>.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Badge Studio</h1>
      <div style={{ color: '#64748b', marginBottom: 16 }}>
        Set badge defaults per organizer + overrides per event.
      </div>

      <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, background: '#fff', marginBottom: 12 }}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Mode</div>
            <div style={{ fontSize: 13 }}>
              Signed in as <b>{isSuper ? 'Superadmin' : 'Tenant Admin'}</b> ✅
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Organizer</div>

            {isSuper ? (
              <>
                <select value={organizerId} onChange={(e) => setOrganizerId(e.target.value)} style={field()}>
                  {organizers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.status || 'unknown'})
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Pick the tenant you’re branding.</div>
              </>
            ) : (
              <>
                <input value={organizerId ? `${organizerId.slice(0, 8)}…` : ''} readOnly style={field()} />
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>You are editing your tenant branding.</div>
              </>
            )}
          </div>
        </div>

        {status ? (
          <div style={{ marginTop: 10, fontSize: 13, color: status.startsWith('✅') ? '#16a34a' : '#b91c1c' }}>
            {status}
          </div>
        ) : null}
      </section>

      {/* Organizer defaults */}
      <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, background: '#fff' }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>Default Badge</h2>

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Template</div>
            <select value={tpl} onChange={(e) => setTpl(e.target.value)} style={field()}>
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Background</div>
            <select value={bg} onChange={(e) => setBg(e.target.value as any)} style={field()}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>

          <div>
            <ColorPicker label="Accent (hex)" value={accent} onChange={setAccent} />
          </div>

          <div style={{ gridColumn: '1 / span 2' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Logo URL (https)</div>
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} style={field()} placeholder="https://..." />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Sponsor Logo (https)</div>
            <input value={sponsorLogoUrl} onChange={(e) => setSponsorLogoUrl(e.target.value)} style={field()} placeholder="https://..." />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={saveDefaultBadge} style={btnPrimary()}>
            Save Defaults
          </button>

          <a href={previewUrl({ template: tpl, bg, accent, logoUrl, sponsorLogoUrl, variant: 'front' })} target="_blank" rel="noreferrer" style={btnGhost()}>
            Preview Front
          </a>

          <a href={previewUrl({ template: tpl, bg, accent, logoUrl, sponsorLogoUrl, variant: 'back' })} target="_blank" rel="noreferrer" style={btnGhost()}>
            Preview Back
          </a>
        </div>
      </section>

      {/* Event override */}
      <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, background: '#fff', marginTop: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>Per-Event Override</h2>

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Event</div>
            <select value={eventSlug} onChange={(e) => setEventSlug(e.target.value)} style={field()}>
              {events.map((ev) => (
                <option key={ev.id} value={ev.slug}>
                  {ev.title} ({ev.slug})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Template</div>
            <select value={etpl} onChange={(e) => setEtpl(e.target.value)} style={field()}>
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Background</div>
            <select value={ebg} onChange={(e) => setEbg(e.target.value as any)} style={field()}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>

          <div>
            <ColorPicker label="Accent (hex)" value={eaccent} onChange={setEaccent} />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Logo URL (https)</div>
            <input value={elogoUrl} onChange={(e) => setElogoUrl(e.target.value)} style={field()} placeholder="https://..." />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Sponsor Logo (https)</div>
            <input value={esponsorLogoUrl} onChange={(e) => setEsponsorLogoUrl(e.target.value)} style={field()} placeholder="https://..." />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={saveEventOverride} style={btnPrimary()}>
            Save Override
          </button>
        </div>
      </section>

      {/* Raw JSON (keep; useful for power users) */}
      <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, background: '#fff', marginTop: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>Raw Brand JSON</h2>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          style={{
            width: '100%',
            minHeight: 220,
            padding: 12,
            borderRadius: 12,
            border: '1px solid #cbd5e1',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button onClick={saveRawBrand} style={btnPrimary()}>
            Save Raw JSON
          </button>
        </div>
      </section>
    </main>
  );
}
