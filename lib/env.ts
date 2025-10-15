// lib/env.ts
// lib/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  // DB
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid URL' }),

  // Keys
  ADMIN_KEY: z.string().optional(),
  NEXT_PUBLIC_ADMIN_KEY: z.string().optional(),
  SCANNER_KEY: z.string().optional(),

  // Tickets
  TICKET_JWT_SECRET: z.string().optional(),               // HS256 legacy
  NEXT_PUBLIC_TICKET_JWKS_PUBLIC: z.string().optional(),  // ES256/JWKS public (optional)

  // Email
  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),       // allow "Tickets <tickets@...>"
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
    .transform(v => (v && v.trim()) || 'http://localhost:3000')
    .pipe(z.string().url()),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const msg = parsed.error.issues
    .map(i => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  // friendly in dev, hard fail in prod
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[env] Missing/invalid env:', msg);
  } else {
    throw new Error(`[env] ${msg}`);
  }
}

// Export a typed config object
export const cfg: z.infer<typeof EnvSchema> = parsed.success ? parsed.data : ({} as any);
