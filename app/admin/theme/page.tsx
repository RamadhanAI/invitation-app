// app/admin/theme/page.tsx  (patch)
// app/admin/theme/page.tsx
import 'server-only';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import type { InputHTMLAttributes } from 'react';
import { getAdminSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hex(v: string | undefined, fallback: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v || '') ? (v as string) : fallback;
}

function safeHttps(maybeUrl: string) {
  const v = (maybeUrl || '').trim();
  if (!v) return '';
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:') return '';
    return u.toString();
  } catch {
    return '';
  }
}

function safeText(v: string | undefined, fallback = '') {
  const s = (v || '').trim();
  return s || fallback;
}

function requireAdmin(nextPath: string) {
  const sess = getAdminSession();
  if (!sess) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  // tenant boundary is already enforced by getAdminSession()
  return sess;
}

async function getTargetOrgId() {
  const sess = requireAdmin('/admin/theme');
  // Tenant sessions have oid; superadmin may not.
  if (sess.role !== 'superadmin') return sess.oid!;
  // Superadmin + impersonation: oid present
  if (sess.oid) return sess.oid;
  return null;
}

async function updateBrand(formData: FormData) {
  'use server';

  const sess = requireAdmin('/admin/theme');

  const targetOrgId =
    sess.role !== 'superadmin'
      ? sess.oid!
      : sess.oid
        ? sess.oid
        : null;

  const primary = formData.get('primary')?.toString() || '#111827';
  const secondary = formData.get('secondary')?.toString() || '#F59E0B';
  const button = formData.get('button')?.toString() || '#111827';
  const headerBlue = formData.get('headerBlue')?.toString() || '#1D4ED8';
  const cta = formData.get('cta')?.toString() || '#B7E000';

  const logoUrl = safeHttps(formData.get('logoUrl')?.toString() || '');
  const sponsorLogoUrl = safeHttps(formData.get('sponsorLogoUrl')?.toString() || '');

  const badgeTemplate = safeText(formData.get('badgeTemplate')?.toString(), 'midnight_gold');
  const badgeAccent = hex(formData.get('badgeAccent')?.toString(), '#D4AF37');
  const badgeBg = safeText(formData.get('badgeBg')?.toString(), '');
  const badgeLogoUrl = safeHttps(formData.get('badgeLogoUrl')?.toString() || '');
  const badgeSponsorLogoUrl = safeHttps(formData.get('badgeSponsorLogoUrl')?.toString() || '');

  const brand = {
    primary: hex(primary, '#111827'),
    secondary: hex(secondary, '#F59E0B'),
    button: hex(button, '#111827'),
    headerBlue: hex(headerBlue, '#1D4ED8'),
    cta: hex(cta, '#B7E000'),

    logoUrl,
    sponsorLogoUrl,

    badge: {
      template: badgeTemplate,
      accent: badgeAccent,
      bg: badgeBg,
      logoUrl: badgeLogoUrl || logoUrl,
      sponsorLogoUrl: badgeSponsorLogoUrl || sponsorLogoUrl,
    },
  } as const;

  if (targetOrgId) {
    // Tenant (or impersonated superadmin): update scoped organizer only
    await prisma.organizer.update({
      where: { id: targetOrgId },
      data: { brand },
    });
  } else {
    // Pure superadmin (no impersonation): keep your original "first organizer" fallback
    const org = await prisma.organizer.findFirst({ select: { id: true } });
    if (!org) {
      await prisma.organizer.create({
        data: {
          name: 'Default',
          email: 'owner@local.example',
          apiKey: process.env.ADMIN_KEY || crypto.randomUUID(),
          brand,
          status: 'active',
        },
      });
    } else {
      await prisma.organizer.update({ where: { id: org.id }, data: { brand } });
    }
  }

  redirect('/admin/theme');
}

export default async function ThemeEditor() {
  const sess = requireAdmin('/admin/theme');

  const targetOrgId =
    sess.role !== 'superadmin'
      ? sess.oid!
      : sess.oid
        ? sess.oid
        : null;

  const org = targetOrgId
    ? await prisma.organizer.findUnique({ where: { id: targetOrgId }, select: { brand: true } })
    : await prisma.organizer.findFirst({ select: { brand: true } });

  const b = typeof org?.brand === 'object' && org?.brand ? (org!.brand as any) : {};
  const badge = b.badge && typeof b.badge === 'object' ? b.badge : {};

  return (
    <div className="space-y-6">
      <form action={updateBrand} className="p-4 a-card md:p-6">
        <h1 className="mb-3 text-xl font-semibold text-white">Branding</h1>
        <p className="text-sm text-[color:var(--muted)] mb-4">
          Set brand colors + default badge styling used across admin, emails, and public tickets.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Primary" name="primary" defaultValue={hex(b.primary, '#111827')} type="color" />
          <Field label="Secondary" name="secondary" defaultValue={hex(b.secondary, '#F59E0B')} type="color" />
          <Field label="Button" name="button" defaultValue={hex(b.button, '#111827')} type="color" />
          <Field label="Header Blue" name="headerBlue" defaultValue={hex(b.headerBlue, '#1D4ED8')} type="color" />
          <Field label="CTA Lime" name="cta" defaultValue={hex(b.cta, '#B7E000')} type="color" />

          <div className="md:col-span-2">
            <Field
              label="Logo URL (legacy)"
              name="logoUrl"
              defaultValue={typeof b.logoUrl === 'string' ? b.logoUrl : ''}
              placeholder="https://…"
            />
          </div>

          <div className="md:col-span-2">
            <Field
              label="Sponsor Logo URL (legacy)"
              name="sponsorLogoUrl"
              defaultValue={typeof b.sponsorLogoUrl === 'string' ? b.sponsorLogoUrl : ''}
              placeholder="https://…"
            />
          </div>

          <div className="pt-2 border-t md:col-span-2 border-white/10" />

          <div className="md:col-span-2">
            <div className="mb-1 text-sm font-semibold text-white">Default Badge</div>
            <div className="text-xs text-[color:var(--muted)]">
              These values are snapshotted into each registration so Preview = Print = Email forever.
            </div>
          </div>

          <Field
            label="Badge Template"
            name="badgeTemplate"
            defaultValue={typeof badge.template === 'string' ? badge.template : 'midnight_gold'}
            placeholder="midnight_gold / pearl_white / emerald_elite / carbon_vip"
          />
          <Field label="Badge Accent" name="badgeAccent" defaultValue={hex(badge.accent, '#D4AF37')} type="color" />

          <Field
            label="Badge Background Key (optional)"
            name="badgeBg"
            defaultValue={typeof badge.bg === 'string' ? badge.bg : ''}
            placeholder="optional semantic key"
          />

          <div className="md:col-span-2">
            <Field
              label="Badge Logo URL (optional, overrides legacy logo)"
              name="badgeLogoUrl"
              defaultValue={typeof badge.logoUrl === 'string' ? badge.logoUrl : ''}
              placeholder="https://…"
            />
          </div>

          <div className="md:col-span-2">
            <Field
              label="Badge Sponsor Logo URL (optional, overrides legacy sponsor)"
              name="badgeSponsorLogoUrl"
              defaultValue={typeof badge.sponsorLogoUrl === 'string' ? badge.sponsorLogoUrl : ''}
              placeholder="https://…"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button className="a-btn a-btn--primary" type="submit">
            Save
          </button>
          <a href="/admin/events" className="a-btn a-btn--ghost">
            Back
          </a>
        </div>
      </form>
    </div>
  );
}

function Field(props: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <div className="mb-1 text-sm text-white">{label}</div>
      <input className="a-input" {...rest} />
    </label>
  );
}
