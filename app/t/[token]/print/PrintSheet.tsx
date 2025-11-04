'use client';

import { useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';

type Brand = {
  primary?: string;
  secondary?: string;
  button?: string;
  logoUrl?: string;
  sponsorLogoUrl?: string;
  [k: string]: unknown;
};

export type PrintData = {
  token: string;
  eventTitle: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  role: string; // ATTENDEE | SPEAKER | ...
  brand: Brand;
  origin: string;
};

type Props = {
  data: PrintData;
  side?: 'front' | 'back';
  auto?: boolean;
};

// Constant CSS to avoid hydration “text content did not match”
const SHEET_CSS = `
  :root { color-scheme: dark; }
  html, body { margin: 0; padding: 0; background: #111; }
  .sheet { width: 190mm; min-height: 120mm; margin: 0 auto; background: white; color: black; box-shadow: 0 0 0.5mm rgba(0,0,0,.1); position: relative; }
  .grid { display: grid; grid-template-columns: repeat(2, max-content); gap: 12mm 18mm; justify-content: start; padding: 10mm; }
  .card { width: 86mm; height: 54mm; position: relative; background: transparent; }
  .face { width: 86mm; height: 54mm; border-radius: 4mm; overflow: hidden; outline: 0.2mm solid rgba(0,0,0,.15); position: relative; }
  .caption { font: 10px/1.2 ui-sans-serif, system-ui; color:#333; text-align:center; margin-top: 2mm; }
  .controls { padding:12px; text-align:center; }
  .btn { display:inline-block; padding:8px 12px; margin:0 6px; border-radius:8px; background:#111; color:#fff; text-decoration:none; font-weight:700; }
  .btn:hover { filter:brightness(1.1); }
  @media print {
    body { background: white; }
    .controls { display: none; }
    .sheet { box-shadow: none; margin: 0; }
  }
`;

function normalizeRole(r?: string) {
  const up = (r || '').trim().toUpperCase();
  const ALLOW = new Set(['ATTENDEE','SPEAKER','VIP','STAFF','MEDIA','EXHIBITOR','SPONSOR']);
  return ALLOW.has(up) ? up : 'ATTENDEE';
}

export default function PrintSheet({ data, side = 'back', auto = false }: Props) {
  // fire print automatically when asked
  useEffect(() => {
    if (!auto) return;
    try { window.print(); } catch {}
  }, [auto]);

  const COLORS = useMemo(() => {
    const primary = (data.brand?.primary as string) || '#0EA5E9';
    const headerText = '#0F172A';
    const ribbonBg = '#2F2CB7';
    const ribbonFg = '#FFFFFF';
    return { primary, headerText, ribbonBg, ribbonFg };
  }, [data.brand]);

  const role = normalizeRole(data.role);

  const Front = () => (
    <div className="face" aria-label="Front of badge">
      {/* Header */}
      <div style={{
        height: '12mm',
        background: COLORS.primary,
        display: 'grid',
        placeItems: 'center',
        font: '700 5mm/1 ui-sans-serif,system-ui',
        color: COLORS.headerText,
      }}>
        {data.eventTitle || 'Event'}
      </div>

      {/* Name / title / company */}
      <div style={{ padding: '5mm 4mm 0 4mm', textAlign: 'center' }}>
        <div style={{ font: '900 6mm/1.1 ui-sans-serif,system-ui', color: '#111827' }}>
          {data.fullName || 'FULL NAME'}
        </div>
        <div style={{ font: '800 4mm/1.2 ui-sans-serif,system-ui', color: '#1E61FF', marginTop: '1.5mm' }}>
          {data.jobTitle || 'JOB TITLE'}
        </div>
        <div style={{ font: '700 3.5mm/1.2 ui-sans-serif,system-ui', color: '#334155', marginTop: '1.5mm' }}>
          {(data.companyName || 'COMPANY NAME').toUpperCase()}
        </div>
      </div>

      {/* Role ribbon */}
      <div style={{ position: 'absolute', left: '4mm', right: '4mm', bottom: '5mm' }}>
        <div style={{
          borderRadius: '3mm',
          height: '13mm',
          background: COLORS.ribbonBg,
          display: 'grid',
          placeItems: 'center',
          outline: '0.2mm solid rgba(0,0,0,.08)',
        }}>
          <span style={{
            color: COLORS.ribbonFg,
            font: '900 6mm/1 ui-sans-serif,system-ui',
            letterSpacing: '1px',
          }}>
            {role}
          </span>
        </div>
      </div>
    </div>
  );

  const Back = () => (
    <div className="face" aria-label="Back of badge">
      {/* Header */}
      <div style={{
        height: '12mm',
        background: COLORS.primary,
        display: 'grid',
        placeItems: 'center',
        font: '700 5mm/1 ui-sans-serif,system-ui',
        color: COLORS.headerText,
      }}>
        SCAN FOR ENTRY
      </div>

      {/* QR */}
      <div style={{ display:'grid', placeItems:'center', height: 'calc(54mm - 12mm - 16mm)' }}>
        <div style={{
          width: '38mm',
          height: '38mm',
          background: '#fff',
          borderRadius: '2mm',
          outline: '0.2mm solid rgba(0,0,0,.2)',
          display: 'grid',
          placeItems: 'center',
        }}>
          <QRCodeSVG value={data.token} size={340} level="M" includeMargin />
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute',
        bottom:'2mm',
        left: 0,
        right: 0,
        textAlign: 'center',
        color:'#334155',
        font:'600 3mm/1.2 ui-sans-serif,system-ui'
      }}>
        {data.eventTitle || 'Event'}
      </div>
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SHEET_CSS }} />
      <div className="controls" aria-hidden>
        <button className="btn" type="button" onClick={() => window.print()}>Print</button>
        <a className="btn" href={`/api/ticket/png?token=${encodeURIComponent(data.token)}`} target="_blank" rel="noreferrer">
          Download PNG
        </a>
      </div>

      <div className="sheet" role="region" aria-label="Badge print sheet">
        <div className="grid">
          <div className="card">
            <Front />
            <div className="caption">Front (86×54 mm)</div>
          </div>

          <div className="card">
            <Back />
            <div className="caption">Back (86×54 mm)</div>
          </div>
        </div>
      </div>
    </>
  );
}
