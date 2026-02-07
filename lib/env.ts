// lib/env.ts
// lib/env.ts
import 'server-only';
import { z } from 'zod';

const isProd = process.env.NODE_ENV === 'production';

// Helper: allow dev fallback, but require in prod
const requiredInProd = (name: string, fallbackDev?: string) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const val = (v ?? '').trim();

      if (isProd) {
        // required in prod
        if (!val) return '__MISSING__';
        return val;
      }

      // dev/test: fallback if missing
      return val || (fallbackDev ?? '');
    })
    .refine((v) => v !== '__MISSING__' && v.length > 0, {
      message: `${name} is required in production`,
    });

const EnvSchema = z.object({
  // DB
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid URL' }),

  // Platform owner (superadmin) credentials
  ADMIN_USER: requiredInProd('ADMIN_USER', 'admin'),
  ADMIN_PASS: requiredInProd('ADMIN_PASS', 'admin123'),

  // Session secrets (HMAC)
  SESSION_SECRET: requiredInProd('SESSION_SECRET', 'dev-change-me'),
  SCANNER_SESSION_SECRET: z
    .string()
    .optional()
    .transform((v) => (v && v.trim()) || '') // empty allowed
    .optional(),

  // Keys (API-key style)
  ADMIN_KEY: z.string().optional(),
  NEXT_PUBLIC_ADMIN_KEY: z.string().optional(),
  SCANNER_KEY: z.string().optional(),

  // Tickets
  TICKET_JWT_SECRET: z.string().optional(), // HS256 legacy
  NEXT_PUBLIC_TICKET_JWKS_PUBLIC: z.string().optional(), // ES256/JWKS public (optional)

  // Email
  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(), // allow "Tickets <tickets@...>"
  EMAIL_REPLY_TO: z.string().optional(),

  // Captcha
  HCAPTCHA_SECRET: z.string().optional(),
  RECAPTCHA_SECRET: z.string().optional(),

  // Webhooks
  WEBHOOK_SIGNING_SECRET: z.string().optional(),

  // App URL (default to localhost if missing or empty)
  NEXT_PUBLIC_APP_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim()) || 'http://localhost:3000')
    .pipe(z.string().url()),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  if (!isProd) {
    console.warn('[env] Missing/invalid env:', msg);
  } else {
    throw new Error(`[env] ${msg}`);
  }
}

// Always export something structured (even in dev warnings mode)
const data = parsed.success ? parsed.data : EnvSchema.parse({
  // minimal dev fallbacks to avoid runtime crashes
  DATABASE_URL: process.env.DATABASE_URL || 'http://localhost:9999/INVALID_DB_URL',
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ADMIN_USER: process.env.ADMIN_USER || 'admin',
  ADMIN_PASS: process.env.ADMIN_PASS || 'admin123',
  SESSION_SECRET: process.env.SESSION_SECRET || 'dev-change-me',
  SCANNER_SESSION_SECRET: process.env.SCANNER_SESSION_SECRET || '',
});

// Final normalized config
export const cfg = {
  ...data,
  // If scanner secret not provided, default to SESSION_SECRET
  SCANNER_SESSION_SECRET: (data.SCANNER_SESSION_SECRET || data.SESSION_SECRET).trim(),
} as const;
