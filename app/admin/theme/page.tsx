// app/admin/theme/page.tsx  (patch)
// app/admin/theme/page.tsx
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hex(v: string | undefined, fallback: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v || '') ? (v as string) : fallback;
}

async function updateBrand(formData: FormData) {
  'use server';

  const primary    = formData.get('primary')?.toString()    || '#111827';
  const secondary  = formData.get('secondary')?.toString()  || '#F59E0B';
  const button     = formData.get('button')?.toString()     || '#111827';
  const headerBlue = formData.get('headerBlue')?.toString() || '#1D4ED8';
  const cta        = formData.get('cta')?.toString()        || '#B7E000';
  let   logoUrl    = formData.get('logoUrl')?.toString()    || '';

  try {
    const u = new URL(logoUrl);
    if (u.protocol !== 'https:') logoUrl = '';
  } catch {
    logoUrl = '';
  }

  const brand = {
    primary:    hex(primary, '#111827'),
    secondary:  hex(secondary, '#F59E0B'),
    button:     hex(button, '#111827'),
    headerBlue: hex(headerBlue, '#1D4ED8'),
    cta:        hex(cta, '#B7E000'),
    logoUrl,
  } as const;

  const org = await prisma.organizer.findFirst({ select: { id: true } });
  if (!org) {
    await prisma.organizer.create({
      data: {
        name: 'Default',
        email: 'owner@local.example',
        apiKey: process.env.ADMIN_KEY || crypto.randomUUID(),
        brand,
      },
    });
  } else {
    await prisma.organizer.update({
      where: { id: org.id },
      data: { brand },
    });
  }

  redirect('/admin/theme');
}

export default async function ThemeEditor() {
  const org = await prisma.organizer.findFirst({ select: { brand: true } });
  const b = (typeof org?.brand === 'object' && org?.brand) ? (org!.brand as any) : {};

  return (
    <div className="space-y-6">
      <form action={updateBrand} className="p-4 a-card md:p-6">
        <h1 className="mb-3 text-xl font-semibold text-white">Admin Theme</h1>
        <p className="text-sm text-[color:var(--muted)] mb-4">
          Set the brand colors used across admin, emails, and public headers.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Primary"
            name="primary"
            defaultValue={hex(b.primary, '#111827')}
            type="color"
          />
          <Field
            label="Secondary"
            name="secondary"
            defaultValue={hex(b.secondary, '#F59E0B')}
            type="color"
          />
          <Field
            label="Button"
            name="button"
            defaultValue={hex(b.button, '#111827')}
            type="color"
          />
          <Field
            label="Header Blue"
            name="headerBlue"
            defaultValue={hex(b.headerBlue, '#1D4ED8')}
            type="color"
          />
          <Field
            label="CTA Lime"
            name="cta"
            defaultValue={hex(b.cta, '#B7E000')}
            type="color"
          />
          <div className="md:col-span-2">
            <Field
              label="Logo URL"
              name="logoUrl"
              defaultValue={typeof b.logoUrl === 'string' ? b.logoUrl : ''}
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

      <div className="p-4 a-card md:p-6">
        <div className="text-sm text-[color:var(--muted)] mb-3">Preview</div>
        <div className="flex flex-wrap gap-3">
          <Swatch label="Primary" color={hex(b.primary, '#111827')} />
          <Swatch label="Secondary" color={hex(b.secondary, '#F59E0B')} />
          <Swatch label="Button" color={hex(b.button, '#111827')} />
          <Swatch label="Header" color={hex(b.headerBlue, '#1D4ED8')} />
          <Swatch label="CTA" color={hex(b.cta, '#B7E000')} />
        </div>
      </div>
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <div className="mb-1 text-sm text-white">{label}</div>
      <input className="a-input" {...rest} />
    </label>
  );
}

function Swatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 text-white">
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: color,
          border: '1px solid var(--line)',
        }}
      />
      <div className="text-sm">
        {label}{' '}
        <span className="text-[color:var(--muted)] ml-1">{color}</span>
      </div>
    </div>
  );
}
