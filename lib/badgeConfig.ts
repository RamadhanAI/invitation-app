// lib/badgeConfig.ts
// lib/badgeConfig.ts
export type BadgeTemplate =
  | 'midnight_gold'
  | 'pearl_white'
  | 'obsidian'
  | 'emerald'
  | 'royal_blue'
  | 'sunrise';

export type BadgeBg = 'dark' | 'light';

export type BadgeConfig = {
  template?: BadgeTemplate;
  accent?: string; // hex #RGB/#RRGGBB
  bg?: BadgeBg;
  logoUrl?: string; // https only
  sponsorLogoUrl?: string; // https only
};

const ALLOW_TEMPLATES = new Set<BadgeTemplate>([
  'midnight_gold',
  'pearl_white',
  'obsidian',
  'emerald',
  'royal_blue',
  'sunrise',
]);

const ALLOW_BG = new Set<BadgeBg>(['dark', 'light']);

function isObj(v: unknown): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function normalizeBrand(brand: unknown): Record<string, any> {
  if (typeof brand === 'string') {
    try {
      const parsed = JSON.parse(brand);
      return isObj(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isObj(brand) ? brand : {};
}

export function safeHex(v: unknown): string | undefined {
  const s = typeof v === 'string' ? v.trim() : '';
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s;
  return undefined;
}

export function safeHttpsUrl(v: unknown): string | undefined {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return undefined;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

function safeTemplate(v: unknown): BadgeTemplate | undefined {
  const s = typeof v === 'string' ? (v.trim() as BadgeTemplate) : undefined;
  if (!s) return undefined;
  return ALLOW_TEMPLATES.has(s) ? s : undefined;
}

function safeBg(v: unknown): BadgeBg | undefined {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!s) return undefined;
  return ALLOW_BG.has(s as BadgeBg) ? (s as BadgeBg) : undefined;
}

function objOrEmpty(v: unknown): Record<string, any> {
  return isObj(v) ? v : {};
}

/** ✅ For storing into DB (Organizer.brand). Keeps only allowed keys/values. */
export function sanitizeBadge(input: unknown): BadgeConfig {
  const raw = objOrEmpty(input);

  const cfg: BadgeConfig = {
    template: safeTemplate(raw.template),
    accent: safeHex(raw.accent),
    bg: safeBg(raw.bg),
    logoUrl: safeHttpsUrl(raw.logoUrl),
    sponsorLogoUrl: safeHttpsUrl(raw.sponsorLogoUrl),
  };

  for (const k of Object.keys(cfg) as Array<keyof BadgeConfig>) {
    if (cfg[k] === undefined || cfg[k] === '') delete cfg[k];
  }

  return cfg;
}

/**
 * Per-organizer badge system:
 * - organizerBrand.badge = default
 * - organizerBrand.events[slug].badge = per-event override (stored inside Organizer.brand)
 * - requestBadgeOverride (e.g. meta.badge) = runtime override (highest precedence)
 */
export function resolveBadgeConfig(args: {
  organizerBrand: unknown;
  eventSlug?: string | null;
  requestBadgeOverride?: unknown;
}): BadgeConfig {
  const brand = normalizeBrand(args.organizerBrand);

  const base = objOrEmpty(brand.badge);

  const perEvent =
    args.eventSlug && isObj(brand.events?.[args.eventSlug]?.badge)
      ? (brand.events[args.eventSlug].badge as Record<string, any>)
      : {};

  const req = objOrEmpty(args.requestBadgeOverride);

  // precedence: request > per-event > base
  const raw = { ...base, ...perEvent, ...req };

  return sanitizeBadge(raw);
}

/** Convert BadgeConfig into query params for /api/ticket/png */
export function badgeConfigToQuery(cfg?: BadgeConfig | null): string {
  if (!cfg) return '';
  const p = new URLSearchParams();
  if (cfg.template) p.set('template', cfg.template);
  if (cfg.accent) p.set('accent', cfg.accent);
  if (cfg.bg) p.set('bg', cfg.bg);
  if (cfg.logoUrl) p.set('logoUrl', cfg.logoUrl);
  if (cfg.sponsorLogoUrl) p.set('sponsorLogoUrl', cfg.sponsorLogoUrl);

  const s = p.toString();
  return s ? `&${s}` : '';
}
