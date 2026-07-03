const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

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

  const fabricated = await req(ctx.baseUrl, 'POST', `/payments/${paymentId}/reverse`, {
    token: financeToken, body: { reason: 'automated test - fabricated confirming officer', confirmed_by: '00000000-0000-0000-0000-000000000099' },
  });
  assert.equal(fabricated.status, 403);
  assert.equal(fabricated.data.error.code, 'TWO_PERSON_REQUIRED');

  const { data: meAdmin } = await req(ctx.baseUrl, 'GET', '/auth/me', { token: adminToken });
  const realOfficer = await req(ctx.baseUrl, 'POST', `/payments/${paymentId}/reverse`, {
    token: financeToken, body: { reason: 'automated test - real distinct officer', confirmed_by: meAdmin.data.id },
  });
  assert.equal(realOfficer.status, 200);

  const afterReversal = await req(ctx.baseUrl, 'GET', `/invoices/${bigInvoice.id}`, { token: financeToken });
  assert.equal(Number(afterReversal.data.data.paid_amount), 0, 'reversing the only payment should zero paid_amount back out');
});
