// RegistrationForm.tsx
// components/RegistrationForm.tsx
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import BadgePedestal from '@/components/BadgePedestal';
import Combobox from '@/components/form/Combobox';
import { COUNTRY_OPTIONS } from '@/lib/countries';
import { DESIGNATION_OPTIONS } from '@/lib/designations';
import { TITLE_OPTIONS } from '@/lib/titles';

const BadgePreviewFlip = dynamic(() => import('./BadgePreviewFlip'), { ssr: false });

type Props = {
  eventSlug: string;
  sponsorLogoUrl?: string;
  /** optional future: organizer default + event override snapshot passed to client */
  badge?: any;
};

const BADGE_WIDTH = 400;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';
const RECAPTCHA_SITEKEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
const HCAPTCHA_SITEKEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

type Role = 'ATTENDEE' | 'VIP' | 'STAFF' | 'SPEAKER' | 'MEDIA';

export default function RegistrationForm({ eventSlug, sponsorLogoUrl, badge }: Props) {
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');

  const [title, setTitle] = useState('');
  const [titleOther, setTitleOther] = useState('');

  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [badgeName, setBadgeName] = useState('');
  const [badgeNameTouched, setBadgeNameTouched] = useState(false);

  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');

  const [nationalityCode, setNationalityCode] = useState('');
  const [residenceCode, setResidenceCode] = useState('');

  const [designation, setDesignation] = useState('');
  const [designationOther, setDesignationOther] = useState('');

  const [dial, setDial] = useState('+971');
  const [mobile, setMobile] = useState('');

  const [role] = useState<Role>('ATTENDEE');

  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<'ok' | 'err' | null>(null);

  const aborter = useRef<AbortController | null>(null);
  const botRef = useRef<HTMLInputElement>(null);
  const [realToken, setRealToken] = useState<string | null>(null);

  const [pulseKey, setPulseKey] = useState(0);
  const bumpPulse = () => setPulseKey((k) => k + 1);

  const titleResolved = useMemo(() => {
    if (title === 'Other') return titleOther.trim();
    return title.trim();
  }, [title, titleOther]);

  useEffect(() => {
    if (badgeNameTouched) return;

    const base = [firstName, lastName].filter(Boolean).join(' ').trim();
    if (!base) return;

    const suggested = [titleResolved, base].filter(Boolean).join(' ').trim();
    if (!suggested) return;

    if (badgeName === suggested) return;

    setBadgeName(suggested);
  }, [titleResolved, firstName, lastName, badgeNameTouched, badgeName]);

  const computedName = useMemo(() => {
    if (badgeName.trim()) return badgeName.trim();
    const base = [firstName, lastName].filter(Boolean).join(' ').trim();
    const titled = [titleResolved, base].filter(Boolean).join(' ').trim();
    return titled || 'FULL NAME';
  }, [badgeName, firstName, lastName, titleResolved]);

  const lineTitle = jobTitle || 'JOB TITLE';
  const lineCompany = company || 'COMPANY NAME';

  const emailOk = /\S+@\S+\.\S+/.test(email);
  const emailsMatch =
    !!email &&
    !!confirmEmail &&
    email.trim().toLowerCase() === confirmEmail.trim().toLowerCase();

  const designationResolved = designation === 'Other' ? designationOther.trim() : designation;

  const requiredOk = Boolean(
    firstName.trim() &&
      lastName.trim() &&
      jobTitle.trim() &&
      nationalityCode &&
      residenceCode &&
      designation &&
      company.trim() &&
      (designation !== 'Other' || designationOther.trim())
  );

  const canSubmit = useMemo(
    () => emailOk && emailsMatch && requiredOk && !submitting,
    [emailOk, emailsMatch, requiredOk, submitting]
  );

  useEffect(() => {
    return () => aborter.current?.abort();
  }, []);

  async function getCaptchaToken(): Promise<string | null> {
    const w = window as any;
    if (!RECAPTCHA_SITEKEY && !HCAPTCHA_SITEKEY) return null;

    try {
      if (RECAPTCHA_SITEKEY && w.grecaptcha?.ready && w.grecaptcha?.execute) {
        await new Promise<void>((resolve) => w.grecaptcha.ready(() => resolve()));
        const tok = await w.grecaptcha.execute(RECAPTCHA_SITEKEY, { action: 'register' });
        if (tok) return String(tok);
      }

      if (HCAPTCHA_SITEKEY && w.hcaptcha?.render && w.hcaptcha?.execute) {
        if (!w.__hcId) {
          const el = document.getElementById('hc-root');
          if (el) {
            w.__hcId = w.hcaptcha.render('hc-root', {
              sitekey: HCAPTCHA_SITEKEY,
              size: 'invisible',
            });
          }
        }

        if (w.__hcId !== undefined && w.__hcId !== null) {
          const maybe = w.hcaptcha.execute(w.__hcId, { async: true });
          if (typeof maybe === 'string') return maybe;
          if (maybe && typeof maybe.then === 'function') {
            const tok = await maybe;
            if (tok) return String(tok);
          }
        }
      }
    } catch {}

    return null;
  }

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

    const captchaToken = await getCaptchaToken();

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: aborter.current.signal,
        body: JSON.stringify({
          slug: eventSlug,
          email: email.trim(),
          captchaToken,
          meta: {
            title: titleResolved || undefined,
            badgeName: badgeName.trim() || undefined,

            firstName: firstName.trim() || undefined,
            lastName: lastName.trim() || undefined,
            company: company.trim() || undefined,
            companyName: company.trim() || undefined,
            jobTitle: jobTitle.trim() || undefined,

            nationalityCode,
            residenceCode,

            designation: designationResolved || undefined,

            dial,
            mobile,
            role,

            sponsorLogoUrl: sponsorLogoUrl || undefined,
            badge: badge || undefined,
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

  function openPrint(auto = true) {
    if (!realToken) return;
    const url = `/t/${encodeURIComponent(realToken)}/print${auto ? '?auto=1' : ''}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function frontPngUrl() {
    if (!realToken) return '#';
    const params = new URLSearchParams({
      token: realToken,
      variant: 'front',
      width: '1200',
      dpi: '300',
      name: computedName, // ✅ always the computed display name
      title: jobTitle || '',
      company: company || '',
      label: role,
    });

    // keep sponsor precedence
    if (sponsorLogoUrl) params.set('sponsorLogoUrl', sponsorLogoUrl);

    const b = badge || {};
    if (typeof b.template === 'string') params.set('template', b.template);
    if (typeof b.bg === 'string') params.set('bg', b.bg);
    if (typeof b.accent === 'string') params.set('accent', b.accent);
    if (typeof b.logoUrl === 'string') params.set('logoUrl', b.logoUrl);
    if (typeof b.sponsorLogoUrl === 'string' && !params.get('sponsorLogoUrl')) {
      params.set('sponsorLogoUrl', b.sponsorLogoUrl);
    }

    return `/api/ticket/png?${params.toString()}`;
  }

  const countryOptions = useMemo(
    () =>
      COUNTRY_OPTIONS.map((c) => ({
        value: c.code,
        label: `${c.flag ? c.flag + ' ' : ''}${c.name}`,
        hint: c.code,
      })),
    []
  );

  const designationOptions = useMemo(
    () => DESIGNATION_OPTIONS.map((d) => ({ value: d, label: d })),
    []
  );

  const titleOptions = useMemo(() => TITLE_OPTIONS.map((t) => ({ value: t, label: t })), []);

  return (
    <>
      {RECAPTCHA_SITEKEY && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITEKEY}`}
          strategy="afterInteractive"
        />
      )}
      {HCAPTCHA_SITEKEY && (
        <Script src="https://js.hcaptcha.com/1/api.js?render=explicit" strategy="afterInteractive" />
      )}
      <div id="hc-root" style={{ display: 'none' }} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.45fr)] xl:grid-cols-[minmax(0,1fr)_minmax(400px,0.5fr)] items-start">
        <form
          onSubmit={onSubmit}
          className={[
            'w-full overflow-hidden rounded-2xl relative',
            // ✅ lighter luxe glass surface
            'border border-white/12',
            'bg-[rgba(255,255,255,0.06)] backdrop-blur-xl',
            'shadow-[0_30px_80px_rgba(0,0,0,0.65),0_0_120px_rgba(212,175,55,0.14)]',
          ].join(' ')}
          autoComplete="off"
          noValidate
        >
          <div className="relative px-4 py-3 overflow-hidden text-sm font-semibold text-white border-b bg-white/5 border-white/10">
            <span className="relative z-10">Please fill out the registration form below</span>
          </div>

          <div className="p-4 space-y-6 text-sm md:p-6 text-white/85">
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
              <div className="md:col-span-2">
                <Combobox
                  label="Title"
                  value={title}
                  onChange={(v) => {
                    setTitle(v);
                    if (v !== 'Other') setTitleOther('');
                    bumpPulse();
                  }}
                  options={[{ value: '', label: 'Select…' }, ...titleOptions]}
                />
              </div>

              {title === 'Other' ? (
                <div className="md:col-span-2">
                  <label className="label">Specify title</label>
                  <input
                    className="input"
                    value={titleOther}
                    onChange={(e) => {
                      setTitleOther(e.target.value);
                      bumpPulse();
                    }}
                    placeholder="e.g., Prince, Coach, H.H."
                  />
                </div>
              ) : null}

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

              <div className="md:col-span-2">
                <label className="label">Name on badge (optional)</label>
                <input
                  className="input"
                  value={badgeName}
                  onChange={(e) => {
                    setBadgeName(e.target.value);
                    setBadgeNameTouched(true);
                    bumpPulse();
                  }}
                  placeholder="Leave blank to use your title + full name"
                />
                <div className="mt-1 text-[11px] text-white/55">
                  Example: “Dr. Amina”, “Sheikh Khalid”, or a shorter name.
                </div>
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
                  aria-invalid={email ? !emailOk : undefined}
                />
                {email && !emailOk && <div className="mt-1 text-xs text-red-300">Enter a valid email</div>}
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
                  aria-invalid={confirmEmail ? !emailsMatch : undefined}
                />
                {confirmEmail && !emailsMatch && <div className="mt-1 text-xs text-red-300">Emails do not match</div>}
              </div>

              <div>
                <Combobox
                  label="Nationality (as on passport) *"
                  value={nationalityCode}
                  onChange={(v) => {
                    setNationalityCode(v);
                    bumpPulse();
                  }}
                  options={[{ value: '', label: 'Select…' }, ...countryOptions]}
                  required
                />
              </div>

              <div>
                <Combobox
                  label="Country of residence (where you live) *"
                  value={residenceCode}
                  onChange={(v) => {
                    setResidenceCode(v);
                    bumpPulse();
                  }}
                  options={[{ value: '', label: 'Select…' }, ...countryOptions]}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Combobox
                  label="Designation *"
                  value={designation}
                  onChange={(v) => {
                    setDesignation(v);
                    if (v !== 'Other') setDesignationOther('');
                    bumpPulse();
                  }}
                  options={[{ value: '', label: 'Select…' }, ...designationOptions]}
                  required
                />
              </div>

              {designation === 'Other' ? (
                <div className="md:col-span-2">
                  <label className="label">Specify designation *</label>
                  <input
                    className="input"
                    value={designationOther}
                    onChange={(e) => {
                      setDesignationOther(e.target.value);
                      bumpPulse();
                    }}
                    placeholder="e.g., Board Member, Advisor"
                    required
                  />
                </div>
              ) : null}

              <div className="md:col-span-2">
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

              <div className="grid grid-cols-3 gap-3 md:col-span-2">
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
                    <option value="+965">+965</option>
                    <option value="+973">+973</option>
                    <option value="+974">+974</option>
                    <option value="+968">+968</option>
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

              <div className="md:col-span-2">
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
                  className={`mt-3 text-sm ${noticeKind === 'err' ? 'text-red-300' : 'text-white/85'}`}
                  aria-live="polite"
                >
                  {notice}
                </div>
              )}

              {realToken && (
                <div className="flex flex-wrap gap-2 mt-4">
                  <button type="button" className="text-sm a-btn a-btn--accent" onClick={() => openPrint(true)}>
                    Print Badge (Front + Back)
                  </button>

                  <a className="text-sm a-btn a-btn--ghost" href={frontPngUrl()} target="_blank" rel="noreferrer">
                    Download Front PNG
                  </a>
                </div>
              )}
            </div>
          </div>
        </form>

        <div
          className={[
            'lg:sticky lg:top-6 flex flex-col items-center w-full rounded-2xl',
            'p-4 md:p-5 border border-white/12',
            // ✅ lighter preview surface (still luxe)
            'bg-[rgba(255,255,255,0.05)] backdrop-blur-xl',
            'shadow-[0_40px_120px_rgba(0,0,0,0.65),0_0_120px_rgba(212,175,55,0.12)]',
          ].join(' ')}
          style={{ minWidth: `${BADGE_WIDTH + 48}px`, maxWidth: 'min(480px,90vw)' }}
        >
          <BadgePedestal pulseKey={pulseKey} className="flex justify-center w-full">
            <BadgePreviewFlip
              width={BADGE_WIDTH}
              token={realToken ?? undefined}
              fullName={computedName}
              jobTitle={lineTitle}
              companyName={lineCompany}
              role={role}
              sponsorLogoUrl={sponsorLogoUrl}
              badge={badge}
            />
          </BadgePedestal>

          {realToken && (
            <div className="mt-4 text-[10px] text-white/55 text-center max-w-[38ch] leading-relaxed">
              This is your live access badge. The same QR was emailed to you. You can re-open or re-print any time.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
