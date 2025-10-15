// lib/meta.ts
// lib/meta.ts

// Minimal JSON types (self-contained; no Prisma import needed)
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [k: string]: JsonValue };
export type JsonArray = JsonValue[];

// What we actually care about from the form / stored meta
export type AttendeeMeta = {
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  companyName?: string;
  // legacy fallback key
  company?: string;
  // scanner/book-keeping (optional)
  scannedBy?: string | null;
  scanLog?: Array<{ at: string; by: string }>;
  [k: string]: unknown;
};

/** Trim a string if given, else return undefined */
const t = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s : undefined;
};

/** Safely coerce any unknown value to a plain object suitable for spreading */
export function toPlainObject(val: unknown): Record<string, unknown> {
  if (!val) return {};
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore parse errors
    }
    return {};
  }
  if (typeof val === "object" && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

/**
 * Safely normalize arbitrary JSON into AttendeeMeta.
 * Accepts objects or JSON strings; ignores arrays/primitives.
 */
export function normalizeMeta(val: unknown): AttendeeMeta {
  return toPlainObject(val) as AttendeeMeta;
}

/** Merge two metas (right-hand overrides), after coercing both to plain objects */
export function mergeMeta(base: unknown, update: unknown): AttendeeMeta {
  const a = toPlainObject(base);
  const b = toPlainObject(update);
  return { ...a, ...b } as AttendeeMeta;
}

/** Keep only the keys our system/UI actually use, and trim strings */
export function pickAttendeeMeta(src: unknown): AttendeeMeta {
  const m = normalizeMeta(src);
  const companyName = t(m.companyName) ?? t(m.company); // prefer companyName
  return {
    firstName: t(m.firstName),
    lastName: t(m.lastName),
    jobTitle: t(m.jobTitle),
    companyName,
    // carry over scanner fields if present
    scannedBy: typeof m.scannedBy === "string" ? t(m.scannedBy) ?? null : null,
    scanLog: Array.isArray(m.scanLog) ? m.scanLog as AttendeeMeta["scanLog"] : undefined,
  };
}

/** Build a display name from any reasonable combination we might have stored */
export function fullNameFromMeta(meta: unknown): string {
  const m = normalizeMeta(meta);
  const candidates: Array<string | undefined> = [
    t((m as any).fullName),
    t((m as any).name),
    [t(m.firstName), t(m.lastName)].filter(Boolean).join(" ") || undefined,
    [t((m as any).firstname), t((m as any).lastname)].filter(Boolean).join(" ") || undefined,
    [t((m as any).givenName), t((m as any).familyName)].filter(Boolean).join(" ") || undefined,
  ];
  return (candidates.find(Boolean) as string | undefined) ?? "";
}

/** Company from a few possible keys */
export function companyFromMeta(meta: unknown): string {
  const m = normalizeMeta(meta);
  return t(m.companyName) ?? t((m as any).company) ?? t((m as any).org) ?? "" ;
}
// lib/meta.ts (append at the end)

// JSON round-trip to ensure only serializable values remain.
export function toInputJson(val: unknown): JsonValue | null {
  if (val == null) return null;
  return JSON.parse(JSON.stringify(val)) as JsonValue;
}
