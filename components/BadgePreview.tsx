// components/BadgePreview.tsx
// components/BadgePreview.tsx
'use client';

import React, { forwardRef, useEffect, useState } from 'react';
import QRCode from 'qrcode';

type Props = {
  fullName?: string;
  jobTitle?: string;
  companyName?: string;
  token?: string;
  width?: number;                 // final rendered width in px
  shine?: 'none' | 'hover' | 'loop'; // kept for compatibility (unused)
};

const BadgePreview = forwardRef<SVGSVGElement, Props>(function BadgePreview(
  { fullName, jobTitle, companyName, token, width = 260 },
  ref
) {
  const name = (fullName ?? '').trim() || 'FULL NAME';
  const title = (jobTitle ?? '').trim() || 'JOB TITLE';
  const company = ((companyName ?? '').trim() || 'COMPANY NAME').toUpperCase();

  // Generate QR once per token as inline SVG
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!token) { setQrSvg(null); return; }
    QRCode.toString(token, { type: 'svg', margin: 1, scale: 10 })
      .then((svg) => {
        if (!alive) return;
        const sized = svg.replace('<svg ', '<svg width="220" height="220" ');
        setQrSvg(sized);
      })
      .catch(() => alive && setQrSvg(null));
    return () => { alive = false; };
  }, [token]);

  const VB_W = 380;
  const VB_H = 560;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width={width}
      height={(VB_H / VB_W) * width}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Badge preview"
    >
      <defs>
        <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"  stopColor="#C7FF65" />
          <stop offset="100%" stopColor="#00D1FF" />
        </linearGradient>

        <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="12" stdDeviation="16" floodOpacity="0.25" />
        </filter>

        <clipPath id="clipCard">
          <rect x="0" y="0" width={VB_W} height={VB_H} rx="22" ry="22" />
        </clipPath>

        <linearGradient id="sheenGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0"   stopColor="rgba(255,255,255,0)" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.5"  stopColor="#E5E7EB" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1"   stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      <g filter="url(#cardShadow)" clipPath="url(#clipCard)">
        {/* Card */}
        <rect x="0" y="0" width={VB_W} height={VB_H} rx="22" ry="22" fill="#fff" stroke="#E5E7EB" />

        {/* Header */}
        <rect x="0" y="0" width={VB_W} height="56" rx="22" ry="22" fill="url(#hdr)" />
        <text x={VB_W/2} y="38" textAnchor="middle" fill="#0F172A" fontSize="18" fontWeight="800"
              fontFamily="system-ui, -apple-system, Segoe UI, Roboto">BADGE PREVIEW</text>

        {/* QR frame */}
        <rect x="90" y="92" width="200" height="200" rx="18" ry="18" fill="#fff" stroke="#E5E7EB" />
        {qrSvg ? (
          <g transform="translate(80,82)">
            {/* eslint-disable-next-line react/no-danger */}
            <g dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </g>
        ) : (
          <rect x="110" y="112" width="160" height="160" fill="#F8FAFC" />
        )}

        {/* Name / Title / Company */}
        <text x={VB_W/2} y="330" textAnchor="middle" fill="#0F172A" fontSize="22" fontWeight="900"
              fontFamily="system-ui, -apple-system, Segoe UI, Roboto">{name}</text>
        <text x={VB_W/2} y="356" textAnchor="middle" fill="#1E61FF" fontSize="16" fontWeight="800"
              fontFamily="system-ui, -apple-system, Segoe UI, Roboto">{title}</text>
        <text x={VB_W/2} y="380" textAnchor="middle" fill="#475569" fontSize="13" fontWeight="600"
              fontFamily="system-ui, -apple-system, Segoe UI, Roboto">{company}</text>

        {/* VISITOR pill */}
        <g>
          <rect x="40" y="408" width="300" height="74" rx="34" ry="34" fill="#2F2CB7" />
          <text x={VB_W/2} y="456" textAnchor="middle" fill="#fff" fontSize="28" fontWeight="900"
                fontFamily="system-ui, -apple-system, Segoe UI, Roboto" letterSpacing="1">
            VISITOR
          </text>
        </g>

        {/* Footnote */}
        <text x={VB_W/2} y="505" textAnchor="middle" fill="#64748B" fontSize="11"
              fontFamily="system-ui, -apple-system, Segoe UI, Roboto">
          <tspan fontWeight="700" fill="#64748B">Important:</tspan> This is a preview of your badge
        </text>
        <text x={VB_W/2} y="520" textAnchor="middle" fill="#64748B" fontSize="11"
              fontFamily="system-ui, -apple-system, Segoe UI, Roboto">
          information only. Your valid QR ticket will be emailed after you
        </text>
        <text x={VB_W/2} y="535" textAnchor="middle" fill="#64748B" fontSize="11"
              fontFamily="system-ui, -apple-system, Segoe UI, Roboto">complete registration.</text>
      </g>

      {/* Subtle diagonal shimmer (preview-only; removed on export) */}
      <g clipPath="url(#clipCard)"
         opacity="0.28"
         style={{ mixBlendMode: 'screen' }}
         data-export-ignore>
        <g transform={`rotate(24 ${VB_W/2} ${VB_H/2})`}>
          <rect x="-420" y="-60" width="70" height={VB_H + 120} fill="url(#sheenGrad)">
            <animate attributeName="x" values="-420; 780" dur="3.2s" repeatCount="indefinite" />
          </rect>
        </g>
      </g>
    </svg>
  );
});

export default BadgePreview;
