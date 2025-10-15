// components/RegistrationForm.tsx
// components/RegistrationForm.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import BadgePreview from './BadgePreview'; // must be the forwardRef SVG version

type Props = { eventSlug: string };

const NATIONALITIES = ['United Arab Emirates', 'Saudi Arabia', 'USA', 'UK', 'Other'];
const DESIGNATION   = ['Executive', 'Director', 'Manager', 'Associate', 'Other'];
const COUNTRIES     = ['United Arab Emirates', 'Saudi Arabia', 'USA', 'UK', 'Other'];

// Right-hand preview width (px)
const BADGE_WIDTH = 260;

// Use public base if provided (works on Vercel preview/prod and local dev)
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

export default function RegistrationForm({ eventSlug }: Props) {
  // Base fields
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [nationality, setNationality] = useState('');
  const [designation, setDesignation] = useState('');
  const [country, setCountry] = useState('');
  const [dial, setDial] = useState('+971');
  const [mobile, setMobile] = useState('');

  // UX
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<'ok' | 'err' | null>(null);
  const aborter = useRef<AbortController | null>(null);

  // Honeypot (anti-bot); real humans won’t see or fill this
  const botRef = useRef<HTMLInputElement>(null);

  // Badge text
  const fullName    = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : 'FULL NAME';
  const lineTitle   = jobTitle || 'JOB TITLE';
  const lineCompany = company || 'COMPANY NAME';

  // After submit, keep ONLY the real token string (enables export buttons)
  const [realToken, setRealToken] = useState<string | null>(null);

  // Access the live SVG node rendered by BadgePreview
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Validation
  const emailOk     = /\S+@\S+\.\S+/.test(email);
  const emailsMatch = email && confirmEmail && email.trim().toLowerCase() === confirmEmail.trim().toLowerCase();
  const requiredOk  =
    firstName.trim() &&
    lastName.trim() &&
    jobTitle.trim() &&
    nationality &&
    designation &&
    country &&
    company.trim();

  const canSubmit = useMemo(
    () => Boolean(emailOk && emailsMatch && requiredOk && !submitting),
    [emailOk, emailsMatch, requiredOk, submitting]
  );

  useEffect(() => () => { aborter.current?.abort(); }, []);

  /* -------------------------- Submit handler -------------------------- */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    // Bot check: if honeypot has content, silently bail
    if (botRef.current?.value) return;

    aborter.current?.abort();
    aborter.current = new AbortController();

    setSubmitting(true);
    setNotice(null);
    setNoticeKind(null);
    setRealToken(null);

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: eventSlug,
          email: email.trim(),
          meta: {
            firstName: firstName.trim() || undefined,
            lastName : lastName.trim()  || undefined,
            company  : company.trim()   || undefined,
            companyName: company.trim() || undefined,
            jobTitle : jobTitle.trim()  || undefined,
            nationality, designation, country, dial, mobile,
          },
        }),
        signal: aborter.current.signal,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? 'Registration failed');

      const tokenStr: string | undefined = json?.registration?.qrToken;
      if (tokenStr) setRealToken(tokenStr);

      setNotice('✅ Check your inbox — your ticket QR has been emailed.');
      setNoticeKind('ok');
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setNotice(`❌ ${err?.message ?? 'Something went wrong'}`);
      setNoticeKind('err');
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------------- Export / Print helpers ---------------------- */

  // Remove preview-only elements (e.g., shimmer) from an SVG clone
  function prunePreviewOnly(root: SVGSVGElement) {
    root.querySelectorAll('[data-export-ignore]').forEach((n) => n.parentNode?.removeChild(n));
  }

  function downloadCurrentSvg() {
    if (!svgRef.current || !realToken) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    prunePreviewOnly(clone);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`;
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(fullName || 'badge').trim().replace(/\s+/g, '-').toLowerCase()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function printCurrentBadgeAsPdf() {
    if (!svgRef.current || !realToken) return;
    try {
      setPrinting(true);
      const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      prunePreviewOnly(clone);

      const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Badge</title>
<style>
  @page { size: 86mm 54mm; margin: 0; }
  html, body { height: 100%; }
  body { margin: 0; padding: 0; display: grid; place-items: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
  .sheet { width: 86mm; height: 54mm; display:flex; align-items:center; justify-content:center; }
  svg { width: 84mm; height: auto; }
</style>
</head>
<body>
  <div class="sheet">${clone.outerHTML}</div>
  <script>requestAnimationFrame(() => { window.print(); });</script>
</body>
</html>`;

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = url;
      document.body.appendChild(iframe);

      const cleanup = () => {
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
          setPrinting(false);
        }, 250);
      };
      iframe.onload = () => {
        iframe.contentWindow?.addEventListener('afterprint', cleanup, { once: true });
        setTimeout(cleanup, 15000);
      };
    } catch (e) {
      console.error(e);
      setPrinting(false);
      setNotice('Could not open the print dialog. Please try again.');
      setNoticeKind('err');
    }
  }

  /* ------------------------------- UI ------------------------------- */

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* Form */}
      <form onSubmit={onSubmit} className="space-y-6 lg:col-span-8" autoComplete="off" noValidate>
        <div className="relative overflow-hidden border rounded-xl border-white/10">
          <div className="relative px-4 py-3 overflow-hidden text-sm font-semibold text-white bg-white/5">
            <span className="relative z-10">Please fill out the registration form below</span>
            <span
              aria-hidden
              className="pointer-events-none absolute -left-1/3 -top-16 h-48 w-[140%] rotate-12 bg-gradient-to-r from-transparent via-white/15 to-transparent"
              style={{ animation: 'sheen 3.6s linear infinite' }}
            />
          </div>

          <div className="p-4 space-y-6">
            {/* Hidden honeypot */}
            <input
              ref={botRef}
              type="text"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
              name="website"
              placeholder="Your website"
            />

            {/* top grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div><label className="label">First Name *</label><input className="input" value={firstName} onChange={(e) => setFirst(e.target.value)} placeholder="Jane" required /></div>
              <div><label className="label">Last Name *</label><input className="input" value={lastName} onChange={(e) => setLast(e.target.value)} placeholder="Doe" required /></div>

              <div>
                <label className="label">Email Address *</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  aria-invalid={email ? !emailOk : undefined}
                />
              </div>
              <div>
                <label className="label">Confirm Email Address *</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="you@company.com"
                  aria-invalid={confirmEmail ? !emailsMatch : undefined}
                />
                {confirmEmail && !emailsMatch && <div className="mt-1 text-xs text-red-400">Emails do not match</div>}
              </div>

              <div>
                <label className="label">Nationality *</label>
                <select className="input" value={nationality} onChange={(e) => setNationality(e.target.value)} required>
                  <option value="">Select…</option>
                  {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Designation Level *</label>
                <select className="input" value={designation} onChange={(e) => setDesignation(e.target.value)} required>
                  <option value="">Select…</option>
                  {DESIGNATION.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div><label className="label">Job Title *</label><input className="input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Procurement Manager" required /></div>

              <div className="grid grid-cols-3 gap-3 md:col-span-1">
                <div className="col-span-1">
                  <label className="label">Code</label>
                  <select className="input" value={dial} onChange={(e) => setDial(e.target.value)}>
                    <option value="+971">+971</option><option value="+966">+966</option><option value="+1">+1</option><option value="+44">+44</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Mobile Number</label>
                  <input
                    className="input"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="5x xxx xxxx"
                    inputMode="tel"
                    pattern="[0-9\s\-()+]*"
                  />
                </div>
              </div>

              <div>
                <label className="label">Country of Residence *</label>
                <select className="input" value={country} onChange={(e) => setCountry(e.target.value)} required>
                  <option value="">Select…</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div><label className="label">Company Name *</label><input className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc." required /></div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                className="btn btn-cta rounded-2xl disabled:opacity-50"
                disabled={!canSubmit}
                type="submit"
                title="Complete your registration"
              >
                {submitting ? 'Registering…' : 'Complete Registration'}
              </button>
              {notice && (
                <div
                  className={`mt-3 text-sm ${noticeKind === 'err' ? 'text-red-300' : 'text-white/80'}`}
                  aria-live="polite"
                >
                  {notice}
                </div>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Right-hand preview */}
      <div className="flex flex-col items-end lg:col-span-4 lg:sticky lg:top-6">
        <div className="banana-card banana-sheen-hover max-w-[280px] p-3">
          <BadgePreview
            ref={svgRef}
            width={BADGE_WIDTH}
            token={realToken ?? undefined}
            fullName={fullName}
            jobTitle={lineTitle}
            companyName={lineCompany}
          />
        </div>

        {realToken && (
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={downloadCurrentSvg}
              disabled={downloading}
              className="px-3 py-2 text-sm border rounded-xl border-white/15 bg-white/10 hover:bg-white/15"
              title="Download badge as SVG"
            >
              Download Badge (SVG)
            </button>
            <button
              type="button"
              onClick={printCurrentBadgeAsPdf}
              disabled={printing}
              className="px-3 py-2 text-sm border rounded-xl border-white/15 bg-white/10 hover:bg-white/15"
              title="Print / Save as PDF"
            >
              {printing ? 'Opening Printer…' : 'Print Badge (PDF)'}
            </button>
          </div>
        )}
      </div>

      {/* Local keyframes for the diagonal sheen on the form header */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes sheen {
  0%   { transform: translateX(-30%) rotate(12deg); }
  100% { transform: translateX(130%) rotate(12deg); }
}
          `,
        }}
      />
    </div>
  );
}
