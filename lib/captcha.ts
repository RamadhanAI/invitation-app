export type CaptchaChoice = 'recaptcha' | 'hcaptcha' | 'none';

export function captchaMode(): CaptchaChoice {
  const hasRe = !!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && !!process.env.RECAPTCHA_SECRET;
  const hasHc = !!process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY && !!process.env.HCAPTCHA_SECRET;
  if (hasRe) return 'recaptcha';
  if (hasHc) return 'hcaptcha';
  return 'none';
}

export async function verifyCaptcha(token?: string): Promise<boolean> {
  const mode = captchaMode();
  if (mode === 'none') return true;         // disabled → always ok
  if (!token) return false;

  try {
    if (mode === 'recaptcha') {
      const secret = process.env.RECAPTCHA_SECRET!;
      const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
      });
      const json = await res.json();
      return !!json.success && (json.score ?? 0) >= 0.5; // v3 score gate
    } else {
      const secret = process.env.HCAPTCHA_SECRET!;
      const res = await fetch('https://hcaptcha.com/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
      });
      const json = await res.json();
      return !!json.success;
    }
  } catch {
    return false; // fail closed if configured
  }
}
