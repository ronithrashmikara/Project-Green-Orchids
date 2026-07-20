const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Stripe = require('stripe');

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_mock_project_green';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_project_green_test';
process.env.STRIPE_MOCK_CHECKOUT = 'true';
process.env.STRIPE_CURRENCY = 'lkr';
process.env.APP_PUBLIC_URL = process.env.APP_PUBLIC_URL || 'http://localhost:3000';
process.env.API_PUBLIC_URL = process.env.API_PUBLIC_URL || 'http://127.0.0.1:5000';

const { startServer, req, login, CREDS } = require('../../test/helpers');

let ctx;
let buyerToken;
let adminToken;
let financeToken;
let invoice;

async function createApprovedInvoice(quantityMultiplier = 1) {
  const { data } = await req(ctx.baseUrl, 'GET', '/products/buyer?limit=50', { token: buyerToken });
  const product = data.products.find((p) => p.status === 'ACTIVE' && p.available >= p.moq * quantityMultiplier);
  await req(ctx.baseUrl, 'DELETE', '/cart', { token: buyerToken });
  await req(ctx.baseUrl, 'POST', '/cart/items', {
    token: buyerToken, body: { product_id: product.id, quantity: product.moq * quantityMultiplier },
  });
  const created = await req(ctx.baseUrl, 'POST', '/orders', { token: buyerToken, body: {} });
  const order = created.data.data;
  await req(ctx.baseUrl, 'PATCH', `/orders/${order.id}/approve`, { token: adminToken, body: {} });
  const invoices = await req(ctx.baseUrl, 'GET', `/invoices?order_id=${order.id}`, { token: buyerToken });
  return invoices.data.data.find((i) => i.order_id === order.id);
}

function stripeAmount(amount) {
  return Math.round(Number(amount) * 100);
}

async function postStripeEvent(event) {
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  return req(ctx.baseUrl, 'POST', '/payments/stripe/webhook', {
    csrf: false,
    rawBody: payload,
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': signature,
    },
  });
}

before(async () => {
  ctx = await startServer();
  buyerToken = await login(ctx.baseUrl, 'buyer1');
  adminToken = await login(ctx.baseUrl, 'admin');
  financeToken = await login(ctx.baseUrl, 'finance');
  invoice = await createApprovedInvoice();
  assert.ok(invoice, 'setup should produce an invoice to pay against');
});

after(async () => { await ctx.close(); });

test('golden path: partial payment -> overpayment rejected -> final payment lands exactly on PAID at zero balance', async () => {
  const total = Number(invoice.total_amount);
  const half = Math.round((total / 2) * 100) / 100;

  const partial = await req(ctx.baseUrl, 'POST', '/payments', {
    token: financeToken, body: { invoice_id: invoice.id, amount: half, method: 'BANK_TRANSFER', reference: 'TEST-PARTIAL' },
  });
  assert.equal(partial.status, 201);

  const midState = await req(ctx.baseUrl, 'GET', `/invoices/${invoice.id}`, { token: financeToken });
  assert.equal(midState.data.data.status, 'PARTIALLY_PAID');
  const remaining = Number(midState.data.data.balance_due);
  assert.ok(remaining > 0);

  const overpay = await req(ctx.baseUrl, 'POST', '/payments', {
    token: financeToken, body: { invoice_id: invoice.id, amount: remaining + 999999, method: 'CASH', reference: 'TEST-OVERPAY' },
  });
  assert.equal(overpay.status, 422);
  assert.equal(overpay.data.error.code, 'OVERPAYMENT');

  const final = await req(ctx.baseUrl, 'POST', '/payments', {
    token: financeToken, body: { invoice_id: invoice.id, amount: remaining, method: 'BANK_TRANSFER', reference: 'TEST-FINAL' },
  });
  assert.equal(final.status, 201);

  const finalState = await req(ctx.baseUrl, 'GET', `/invoices/${invoice.id}`, { token: financeToken });
  assert.equal(finalState.data.data.status, 'PAID');
  assert.equal(Number(finalState.data.data.balance_due), 0);
});

test('buyer online payment creates a Stripe Checkout Session and only a signed paid webhook settles the invoice', async () => {
  const onlineInvoice = await createApprovedInvoice();
  const amount = Number(onlineInvoice.balance_due);

  const checkout = await req(ctx.baseUrl, 'POST', `/invoices/${onlineInvoice.id}/pay`, {
    token: buyerToken,
    body: { amount },
  });
  assert.equal(checkout.status, 201);
  const session = checkout.data.data;
  assert.equal(session.provider, 'STRIPE');
  assert.match(session.checkout_url, /^https:\/\/checkout\.stripe\.com\/c\/pay\//);
  assert.ok(session.session_id.startsWith('cs_test_'));
  assert.equal(Number(session.transaction.amount), amount);
  assert.equal(session.transaction.currency, 'LKR');

  const afterInit = await req(ctx.baseUrl, 'GET', `/invoices/${onlineInvoice.id}`, { token: financeToken });
  assert.equal(Number(afterInit.data.data.paid_amount), 0, 'checkout initiation must not self-record a payment');
  assert.equal(afterInit.data.data.status, 'PENDING');

  const baseStripeSession = {
    id: session.session_id,
    object: 'checkout.session',
    client_reference_id: session.transaction.gateway_order_id,
    metadata: { gateway_order_id: session.transaction.gateway_order_id, invoice_id: String(onlineInvoice.id) },
    amount_total: stripeAmount(amount),
    currency: 'lkr',
  };

  const failed = await postStripeEvent({
    id: `evt_failed_${session.session_id}`,
    object: 'event',
    type: 'checkout.session.async_payment_failed',
    data: { object: { ...baseStripeSession, payment_status: 'unpaid', payment_intent: `pi_failed_${session.session_id}` } },
  });
  assert.equal(failed.status, 200);
  const afterFailed = await req(ctx.baseUrl, 'GET', `/invoices/${onlineInvoice.id}`, { token: financeToken });
  assert.equal(Number(afterFailed.data.data.paid_amount), 0, 'failed Stripe webhooks must not create ledger payments');

  const paidSession = { ...baseStripeSession, payment_status: 'paid', payment_intent: `pi_paid_${session.session_id}` };
  const settled = await postStripeEvent({
    id: `evt_paid_${session.session_id}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: { object: paidSession },
  });
  assert.equal(settled.status, 200);

  const afterSuccess = await req(ctx.baseUrl, 'GET', `/invoices/${onlineInvoice.id}`, { token: financeToken });
  assert.equal(afterSuccess.data.data.status, 'PAID');
  assert.equal(Number(afterSuccess.data.data.balance_due), 0);

  const replay = await postStripeEvent({
    id: `evt_replay_${session.session_id}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: { object: paidSession },
  });
  assert.equal(replay.status, 200);
  const paymentCount = await ctx.pool.query(
    'SELECT COUNT(*)::int AS count FROM payments WHERE invoice_id = $1 AND reference = $2',
    [onlineInvoice.id, paidSession.payment_intent]
  );
  assert.equal(paymentCount.rows[0].count, 1, 'Stripe webhook replay must be idempotent');
});

test('two-person rule on large reversals rejects a fabricated or wrong-permission confirmed_by, and accepts a real distinct officer (regression: BUG-004)', async () => {
  // A fresh, large (>50,000) payment on its own invoice so this test doesn't depend on the
  // exact numbers left behind by the previous test.
  const bigInvoice = await createApprovedInvoice(50);
  const bigPayment = await req(ctx.baseUrl, 'POST', '/payments', {
    token: financeToken,
    body: { invoice_id: bigInvoice.id, amount: Number(bigInvoice.total_amount), method: 'BANK_TRANSFER', reference: 'TEST-BIG' },
  });
  assert.equal(bigPayment.status, 201);
  const paymentId = bigPayment.data.data.id;
  assert.ok(Number(bigPayment.data.data.amount) > 50000, 'this test needs a payment over the two-person threshold');

  const noConfirm = await req(ctx.baseUrl, 'POST', `/payments/${paymentId}/reverse`, {
    token: financeToken, body: { reason: 'automated test - no confirming officer' },
  });
  assert.equal(noConfirm.status, 403);
  assert.equal(noConfirm.data.error.code, 'TWO_PERSON_REQUIRED');

  const wrongOfficer = await req(ctx.baseUrl, 'POST', `/payments/${paymentId}/reverse`, {
    token: financeToken,
    body: {
      reason: 'automated test - wrong confirming officer credentials',
      confirming_officer_email: CREDS.admin.email,
      confirming_officer_password: 'not-the-admin-password',
    },
  });
  assert.equal(wrongOfficer.status, 403);
  assert.equal(wrongOfficer.data.error.code, 'TWO_PERSON_REQUIRED');

  const realOfficer = await req(ctx.baseUrl, 'POST', `/payments/${paymentId}/reverse`, {
    token: financeToken,
    body: {
      reason: 'automated test - real distinct officer',
      confirming_officer_email: CREDS.admin.email,
      confirming_officer_password: CREDS.admin.password,
    },
  });
  assert.equal(realOfficer.status, 200);

  const afterReversal = await req(ctx.baseUrl, 'GET', `/invoices/${bigInvoice.id}`, { token: financeToken });
  assert.equal(Number(afterReversal.data.data.paid_amount), 0, 'reversing the only payment should zero paid_amount back out');
});
