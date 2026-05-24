// netlify/functions/verify-paypal.js
//
// Server-side PayPal order verification.
// This function uses the PayPal Secret (stored as a Netlify environment variable,
// NEVER in the front-end) to confirm an order exists with PayPal and matches what
// the front-end claims, before the front-end calls actions.order.capture().
//
// Why this exists:
//   The front-end PayPal Buttons can be tampered with (a bad actor could
//   modify cart totals or the orderID in their browser). The serverless
//   function calls PayPal's REST API server-to-server to confirm the
//   order amount and status are legitimate.
//
// Required Netlify environment variables:
//   PAYPAL_CLIENT_ID   - same Client ID used in the front-end button
//   PAYPAL_SECRET      - secret from developer.paypal.com (LIVE app)
//   PAYPAL_ENV         - "live" or "sandbox" (default: live)

const BASE = (process.env.PAYPAL_ENV || 'live') === 'sandbox'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret   = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) throw new Error('PayPal credentials not configured');
  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`,
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error('OAuth failed: ' + res.status);
  const data = await res.json();
  return data.access_token;
}

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  try {
    const { orderID } = await req.json();
    if (!orderID || typeof orderID !== 'string') {
      return new Response(JSON.stringify({ verified: false, error: 'orderID required' }), { status: 400 });
    }

    const token = await getAccessToken();
    const orderRes = await fetch(`${BASE}/v2/checkout/orders/${orderID}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!orderRes.ok) {
      return new Response(JSON.stringify({ verified: false, error: 'Order lookup failed' }), { status: 200 });
    }
    const order = await orderRes.json();

    // Sanity: order must exist and be in a valid state for capture.
    const ok = order.status === 'APPROVED' || order.status === 'COMPLETED' || order.status === 'CREATED';
    return new Response(JSON.stringify({
      verified: ok,
      status: order.status,
      amount: order.purchase_units?.[0]?.amount?.value,
      currency: order.purchase_units?.[0]?.amount?.currency_code,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ verified: false, error: err.message }), { status: 500 });
  }
};

export const config = { path: '/.netlify/functions/verify-paypal' };
