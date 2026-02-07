// components/form/Combobox.tsx
'use client';

import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { useEffect, useMemo, useRef, useState } from 'react';

type Option = { value: string; label: string; hint?: string };

type Props = {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

export default function Combobox({
  label,
  placeholder = 'Select…',
  value,
  onChange,
  options,
  disabled,
  required,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(() => options.find((o) => o.value === value) || null, [options, value]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.value} ${o.hint || ''}`.toLowerCase();
      return hay.includes(query);
    });
  }, [options, q]);

  useEffect(() => {
    if (open) {
      // give popover a tick, then focus
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <div className={className}>
      {label ? (
        <label className="label">
          {label} {required ? <span className="text-white/60">*</span> : null}
        </label>
      ) : null}

      <Popover.Root open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={[
              'input flex items-center justify-between gap-2',
              disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
            aria-haspopup="listbox"
            aria-expanded={open}
            disabled={disabled}
          >
            <span className={selected ? '' : 'text-white/50'}>
              {selected ? selected.label : placeholder}
            </span>
            <span className="text-white/50">⌄</span>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            sideOffset={10}
            align="start"
            className="z-[80] w-[--radix-popover-trigger-width] overflow-hidden rounded-2xl border border-white/10 bg-[rgba(10,10,14,0.96)] shadow-[0_30px_80px_rgba(0,0,0,0.8)] backdrop-blur-xl"
          >
            <Command className="w-full">
              <div className="p-2 border-b border-white/10">
                <Command.Input
                  ref={inputRef}
                  value={q}
                  onValueChange={setQ}
                  placeholder="Type to search…"
                  className="w-full px-3 py-2 text-sm text-white outline-none rounded-xl bg-white/5 placeholder:text-white/40"
                />
              </div>

              <Command.List className="max-h-[280px] overflow-auto p-1">
                {filtered.length === 0 ? (
                  <Command.Empty className="px-3 py-3 text-sm text-white/60">
                    No results
                  </Command.Empty>
                ) : (
                  filtered.map((o) => (
                    <Command.Item
                      key={o.value}
                      value={`${o.label} ${o.value} ${o.hint || ''}`}
                      onSelect={() => {
                        onChange(o.value);
                        setOpen(false);
                        setQ('');
                      }}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-white/80 cursor-pointer data-[selected=true]:bg-white/10"
                    >
                      <span className="truncate">{o.label}</span>
                      {o.hint ? <span className="text-[11px] text-white/40">{o.hint}</span> : null}
                    </Command.Item>
                  ))
                )}
              </Command.List>
            </Command>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
