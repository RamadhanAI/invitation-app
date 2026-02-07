// components/form/ColorPicker.tsx
'use client';

import { useMemo, useState } from 'react';

const PRESETS = [
  { name: 'Gold', value: '#D4AF37' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Midnight', value: '#0B1220' },
  { name: 'Silver', value: '#CBD5E1' },
  { name: 'White', value: '#FFFFFF' },
] as const;

function isHex(v: string) {
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(v.trim());
}

type Props = {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  required?: boolean;
};

export default function ColorPicker({ label, value, onChange, required }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const safeValue = useMemo(() => (isHex(value) ? value : '#D4AF37'), [value]);

  return (
    <div>
      <label className="label">
        {label} {required ? <span className="text-white/60">*</span> : null}
      </label>

      <div className="flex items-center gap-3">
        <input
          type="color"
          value={safeValue}
          onChange={(e) => onChange(e.target.value)}
          className="p-1 border h-11 w-14 rounded-xl border-white/10 bg-white/5"
          aria-label={`${label} picker`}
        />

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className="px-3 py-2 text-xs border rounded-xl border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
              onClick={() => onChange(p.value)}
              title={p.value}
            >
              {p.name}
            </button>
          ))}

          <button
            type="button"
            className="px-3 py-2 text-xs border rounded-xl border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            Advanced
          </button>
        </div>
      </div>

      {showAdvanced ? (
        <div className="mt-2">
          <input
            className="input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#D4AF37"
            aria-label={`${label} hex`}
          />
          <div className="mt-1 text-[11px] text-white/50">
            Tip: you can paste a hex code here if you have one.
          </div>
        </div>
      ) : null}
    </div>
  );
}
