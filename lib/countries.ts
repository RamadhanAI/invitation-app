// lib/countries.ts
// lib/countries.ts
import countries from 'world-countries';

export type CountryOption = {
  code: string;   // ISO2
  name: string;
  region?: string;
  flag?: string;
};

function safeFlag(cca2?: string) {
  if (!cca2 || cca2.length !== 2) return undefined;
  const codePoints = cca2
    .toUpperCase()
    .split('')
    .map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function getCommonName(item: any): string | null {
  // world-countries usually has `name.common`, but be defensive
  const n = item?.name?.common;
  if (typeof n === 'string' && n.trim()) return n.trim();
  // fallback: sometimes `name` itself is string-ish
  if (typeof item?.name === 'string' && item.name.trim()) return item.name.trim();
  return null;
}

function isCountryOption(v: CountryOption | null | undefined): v is CountryOption {
  return !!v && typeof v.code === 'string' && v.code.length === 2 && typeof v.name === 'string' && v.name.length > 0;
}

const raw: Array<CountryOption | null> = (countries as any[]).map((c) => {
  const code = typeof c?.cca2 === 'string' ? c.cca2.trim().toUpperCase() : '';
  const name = getCommonName(c);

  if (!code || !name) return null;

  const region = typeof c?.region === 'string' && c.region.trim() ? c.region.trim() : undefined;

  return {
    code,
    name,
    region,
    flag: safeFlag(code),
  };
});

export const COUNTRY_OPTIONS: CountryOption[] = raw
  .filter(isCountryOption)
  .sort((a, b) => a.name.localeCompare(b.name));
