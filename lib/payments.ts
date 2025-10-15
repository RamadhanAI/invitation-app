// lib/payments.ts
const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS === 'on';

// ── Public API your code can import ─────────────────────────
export async function handleStripeWebhook(_event: any) {
  if (!PAYMENTS_ENABLED) {
    console.log('Stripe webhook received (noop; payments disabled).');
    return;
  }
  // if you ever turn it on, swap implementation
}

export async function createStripeSession(_opts: {
  eventId: string;
  email: string;
  price: number;
}) {
  if (!PAYMENTS_ENABLED) {
    throw new Error('Stripe is not enabled in this environment.');
  }
  // real impl when enabled
}

export async function createRegistration() {
  if (!PAYMENTS_ENABLED) {
    throw new Error('Stripe is not enabled in this environment.');
  }
  // real impl when enabled
}
