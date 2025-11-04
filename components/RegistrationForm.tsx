// components/RegistrationFormFlip.tsx
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import BadgePedestal from '@/components/BadgePedestal';

// We don’t want type noise here; allow 'any' to avoid red squiggles from dynamic import.
const BadgePreviewFlip: any = dynamic(() => import('./BadgePreviewFlip'), { ssr: false });

type Props = { eventSlug: string; sponsorLogoUrl?: string };

const NATIONALITIES = ['United Arab Emirates', 'Saudi Arabia', 'USA', 'UK', 'Other'];
const DESIGNATION = ['Executive', 'Director', 'Manager', 'Associate', 'Other'];
const COUNTRIES = ['United Arab Emirates', 'Saudi Arabia', 'USA', 'UK', 'Other'];

const BADGE_WIDTH = 400;
// Only NEXT_PUBLIC_* is readable on the client:
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

export default function RegistrationFormFlip({ eventSlug, sponsorLogoUrl }: Props) {
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

  // default badge role (never "VISITOR")
  const [role] = useState<'ATTENDEE' | 'VIP' | 'STAFF' | 'SPEAKER' | 'MEDIA'>('ATTENDEE');

  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<'ok' | 'err' | null>(null);
  const aborter = useRef<AbortController | null>(null);
  const botRef = useRef<HTMLInputElement>(null);
  const [realToken, setRealToken] = useState<string | null>(null);

  const fullName = firstName || lastName ? `${firstName} ${lastName}`.trim() : 'FULL NAME';
  const lineTitle = jobTitle || 'JOB TITLE';
  const lineCompany = company || 'COMPANY NAME';

  const [pulseKey, setPulseKey] = useState(0);
  const bumpPulse = () => setPulseKey((k) => k + 1);

  const emailOk = /\S+@\S+\.\S+/.test(email);
  const emailsMatch =
    !!email &&
    !!confirmEmail &&
    email.trim().toLowerCase() === confirmEmail.trim().toLowerCase();

  const requiredOk = Boolean(
    firstName.trim() &&
      lastName.trim() &&
      jobTitle.trim() &&
      nationality &&
      designation &&
      country &&
      company.trim()
  );

  const canSubmit = useMemo(
    () => emailOk && emailsMatch && requiredOk && !submitting,
    [emailOk, emailsMatch, requiredOk, submitting]
  );

  useEffect(() => {
    return () => aborter.current?.abort();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
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
        signal: aborter.current.signal,
        body: JSON.stringify({
          slug: eventSlug,
          email: email.trim(),
          meta: {
            firstName: firstName.trim() || undefined,
            lastName: lastName.trim() || undefined,
            company: company.trim() || undefined,
            companyName: company.trim() || undefined,
            jobTitle: jobTitle.trim() || undefined,
            nationality,
            designation,
            country,
            dial,
            mobile,
            role,
          },
        }),
      });

      const json: any = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? 'Registration failed');

      const tokenStr: string | undefined = json?.registration?.qrToken;
      if (tokenStr) setRealToken(tokenStr);

      setNotice('✅ Check your inbox — your badge + QR have been emailed.');
      setNoticeKind('ok');
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setNotice(`❌ ${err?.message ?? 'Something went wrong'}`);
      setNoticeKind('err');
    } finally {
      setSubmitting(false);
    }
  }

  function openPrint(side: 'front' | 'back' = 'back', auto = false) {
    if (!realToken) return;
    const url = `/t/${encodeURIComponent(realToken)}/print?side=${side}${auto ? '&auto=1' : ''}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.45fr)] xl:grid-cols-[minmax(0,1fr)_minmax(400px,0.5fr)] items-start">
      {/* LEFT: FORM */}
      <form
        onSubmit={onSubmit}
        className="w-full overflow-hidden rounded-2xl border border-white/10 bg-[rgba(15,15,20,0.6)] backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.8),0_0_120px_rgba(139,92,246,0.22)] relative"
        autoComplete="off"
        noValidate
      >
        <div className="relative px-4 py-3 overflow-hidden text-sm font-semibold text-white border-b bg-white/5 border-white/10">
          <span className="relative z-10">Please fill out the registration form below</span>
        </div>

        <div className="p-4 space-y-6 text-sm md:p-6 text-white/80">
          <input
            ref={botRef}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
            name="website"
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="label">First Name *</label>
              <input
                className="input"
                value={firstName}
                onChange={(e) => {
                  setFirst(e.target.value);
                  bumpPulse();
                }}
                required
              />
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input
                className="input"
                value={lastName}
                onChange={(e) => {
                  setLast(e.target.value);
                  bumpPulse();
                }}
                required
              />
            </div>

            <div>
              <label className="label">Email Address *</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  bumpPulse();
                }}
                required
                aria-invalid={email ? (!emailOk).toString() as any : undefined}
              />
            </div>
            <div>
              <label className="label">Confirm Email Address *</label>
              <input
                className="input"
                type="email"
                value={confirmEmail}
                onChange={(e) => {
                  setConfirmEmail(e.target.value);
                  bumpPulse();
                }}
                required
                aria-invalid={confirmEmail ? (!emailsMatch).toString() as any : undefined}
              />
              {confirmEmail && !emailsMatch && (
                <div className="mt-1 text-xs text-red-400">Emails do not match</div>
              )}
            </div>

            <div>
              <label className="label">Nationality *</label>
              <select
                className="input"
                value={nationality}
                onChange={(e) => {
                  setNationality(e.target.value);
                  bumpPulse();
                }}
                required
              >
                <option value="">Select…</option>
                {NATIONALITIES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Designation Level *</label>
              <select
                className="input"
                value={designation}
                onChange={(e) => {
                  setDesignation(e.target.value);
                  bumpPulse();
                }}
                required
              >
                <option value="">Select…</option>
                {DESIGNATION.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Job Title *</label>
              <input
                className="input"
                value={jobTitle}
                onChange={(e) => {
                  setJobTitle(e.target.value);
                  bumpPulse();
                }}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="label">Code</label>
                <select
                  className="input"
                  value={dial}
                  onChange={(e) => {
                    setDial(e.target.value);
                    bumpPulse();
                  }}
                >
                  <option value="+971">+971</option>
                  <option value="+966">+966</option>
                  <option value="+1">+1</option>
                  <option value="+44">+44</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Mobile Number</label>
                <input
                  className="input"
                  value={mobile}
                  onChange={(e) => {
                    setMobile(e.target.value);
                    bumpPulse();
                  }}
                  inputMode="tel"
                  pattern="[0-9\s()+-]*"
                />
              </div>
            </div>

            <div>
              <label className="label">Country of Residence *</label>
              <select
                className="input"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  bumpPulse();
                }}
                required
              >
                <option value="">Select…</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Company Name *</label>
              <input
                className="input"
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value);
                  bumpPulse();
                }}
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <button className="btn-cta rounded-2xl disabled:opacity-50" disabled={!canSubmit} type="submit">
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

            {realToken && (
              <div className="flex flex-wrap gap-2 mt-4">
                <a
                  className="text-sm a-btn a-btn--accent"
                  href={`/t/${encodeURIComponent(realToken)}/print?side=front`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View / Download Front
                </a>
                <a
                  className="text-sm a-btn a-btn--accent"
                  href={`/t/${encodeURIComponent(realToken)}/print?side=back`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View / Download Back (QR)
                </a>
                {/* Single print button only */}
                <button
                  type="button"
                  className="text-sm a-btn a-btn--ghost"
                  onClick={() => openPrint('back', true)}
                >
                  Print Badge Now
                </button>
              </div>
            )}
          </div>
        </div>
      </form>

      {/* RIGHT: Preview */}
      <div
        className="lg:sticky lg:top-6 flex flex-col items-center w-full rounded-2xl banana-card banana-sheen-hover p-4 md:p-5 border border-[hsla(var(--banana-sun)/0.12)] shadow-[0_40px_120px_rgba(183,224,0,0.12),0_40px_120px_rgba(0,0,0,0.8)] bg-[radial-gradient(120%_120%_at_0%_0%,hsla(var(--banana-sun)/0.08)_0%,rgba(0,0,0,.8)_40%,rgba(0,0,0,.85)_100%)]"
        style={{ minWidth: BADGE_WIDTH + 48 + 'px', maxWidth: 'min(480px,90vw)' }}
      >
        <BadgePedestal pulseKey={pulseKey} className="flex justify-center w-full">
          <BadgePreviewFlip
            width={BADGE_WIDTH}
            token={realToken ?? undefined}
            fullName={fullName}
            jobTitle={lineTitle}
            companyName={lineCompany}
            role={role as any} // prop accepts string; keep simple
            sponsorLogoUrl={sponsorLogoUrl}
          />
        </BadgePedestal>

        {realToken && (
          <div className="mt-4 text-[10px] text-white/50 text-center max-w-[38ch] leading-relaxed">
            This is your live access badge. The same QR was emailed to you. You can re-open or re-print any time.
          </div>
        )}
      </div>
    </div>
  );
}
