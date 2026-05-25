// netlify/functions/create-checkout.js
//
// Server-side Stripe Checkout Session creator for PARALLEL.
// The browser POSTs a cart payload [{pid, qty}, ...] and receives back a
// hosted Stripe Checkout URL to redirect to.
//
// Why server-side: the Stripe Secret Key (sk_test_... / sk_live_...) must
// never appear in the browser. Prices are also looked up server-side from
// a trusted catalog so a tampered client can't pay $0.01 for a $86 ETB.
//
// Required Netlify environment variables:
//   STRIPE_SECRET_KEY   - sk_test_... (test) or sk_live_... (live)
//   STRIPE_MODE         - "test" or "live" (informational, default: test)
//   SITE_URL            - https://paralleltrading.net (success/cancel redirect base)

import Stripe from 'stripe';

// Server-side catalog. Prices in USD. Keep in sync with /js/products.js.
// Authoritative source for what is actually charged.
const CATALOG = {
  'triple-whammy-tin':         { price: 22.99, name: "Pokemon TCG: Triple Whammy Tin" },
  'prismatic-surprise-box':    { price: 70.99, name: "Pokemon TCG: Prismatic Evolutions Surprise Box" },
  'perfect-order-pc-etb':      { price: 85.99, name: "Pokemon TCG: Mega Evolution - Perfect Order PC Elite Trainer Box" },
  'chaos-rising-etb':          { price: 85.99, name: "Pokemon TCG: Scarlet & Violet - Chaos Rising Elite Trainer Box" },
  'mega-zygarde-premium':      { price: 64.99, name: "Pokemon TCG: Mega Zygarde ex Premium Collection" },
  'moonlit-tin-mega-gengar':   { price: 24.99, name: "Pokemon TCG: Moonlit Tin - Mega Gengar" },
  'hops-zacian-ex-box':        { price: 21.99, name: "Pokemon TCG: Hop's Zacian ex Box" },
  'chaos-rising-booster-bundle': { price: 26.99, name: "Pokemon TCG: Chaos Rising Booster Bundle" },
  'chaos-rising-blister':      { price: 14.99, name: "Pokemon TCG: Chaos Rising 3-Booster Blister" },
};

const SITE_URL = (process.env.SITE_URL || 'https://paralleltrading.net').replace(/\/$/, '');

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      return new Response(JSON.stringify({ error: 'Stripe not configured on server (missing STRIPE_SECRET_KEY)' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
    const stripe = new Stripe(key, { apiVersion: '2024-06-20' });

    const body = await req.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) {
      return new Response(JSON.stringify({ error: 'Cart is empty' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const line_items = [];
    for (const it of items) {
      const pid = String(it?.pid || '');
      const qty = Math.max(1, Math.min(10, parseInt(it?.qty, 10) || 1));
      const prod = CATALOG[pid];
      if (!prod) {
        return new Response(JSON.stringify({ error: 'Unknown product: ' + pid }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      line_items.push({
        quantity: qty,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(prod.price * 100),
          product_data: { name: prod.name },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: SITE_URL + '/success.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: SITE_URL + '/cart.html?canceled=1',
      shipping_address_collection: { allowed_countries: ['US'] },
      shipping_options: [{
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: 500, currency: 'usd' },
          display_name: 'Standard Shipping',
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 3 },
            maximum: { unit: 'business_day', value: 7 },
          },
        },
      }],
      phone_number_collection: { enabled: false },
      automatic_tax: { enabled: false },
      allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ url: session.url, id: session.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
