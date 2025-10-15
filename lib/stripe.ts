// lib/stripe.ts
// lib/stripe.ts

// Stripe-off fallback
export async function handleStripeWebhook(_event: any) {
    console.log('Stripe webhook received (no-op in current mode).');
    return;
  }
  
  // Placeholder for enabling payments later
  export async function createStripeSession(_opts: {
    eventId: string;
    email: string;
    price: number;
  }) {
    throw new Error('Stripe is not enabled in this environment.');
  }
  
  // Placeholder for registration creation via Stripe
  export async function createRegistration() {
    throw new Error('Stripe is not enabled in this environment.');
  }
  