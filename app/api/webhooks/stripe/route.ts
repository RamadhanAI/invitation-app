// app/api/webhooks/stripe/route.ts
// app/api/webhooks/stripe/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { handleStripeWebhook } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET;

  // If Stripe isn’t configured, do nothing (prevents 500s in dev)
  if (!sig || !secret || !key) return new NextResponse('Stripe disabled', { status: 204 });

  const stripe = new Stripe(key);
  const raw = await req.text();

  try {
    const event = stripe.webhooks.constructEvent(raw, sig, secret);
    await handleStripeWebhook(event);
    return new NextResponse('OK', { status: 200 });
  } catch (err: any) {
    console.error('Webhook error:', err?.message || err);
    return new NextResponse('Bad webhook', { status: 400 });
  }
}
