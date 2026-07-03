const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let adminToken;
let buyerToken;
let financeToken;

before(async () => {
  ctx = await startServer();
  adminToken = await login(ctx.baseUrl, 'admin');
  buyerToken = await login(ctx.baseUrl, 'buyer1');
  financeToken = await login(ctx.baseUrl, 'finance');
});

after(async () => { await ctx.close(); });

test('a real business event (payment) enqueues an outbox row with a resolved recipient email, not a hardcoded null', async () => {
  const { data } = await req(ctx.baseUrl, 'GET', '/products/buyer?limit=50', { token: buyerToken });
  const product = data.products.find((p) => p.status === 'ACTIVE' && p.available >= p.moq);
  await req(ctx.baseUrl, 'DELETE', '/cart', { token: buyerToken });
  await req(ctx.baseUrl, 'POST', '/cart/items', { token: buyerToken, body: { product_id: product.id, quantity: product.moq } });
  const created = await req(ctx.baseUrl, 'POST', '/orders', { token: buyerToken, body: {} });
  await req(ctx.baseUrl, 'PATCH', `/orders/${created.data.data.id}/approve`, { token: adminToken, body: {} });
  const invoices = await req(ctx.baseUrl, 'GET', `/invoices?order_id=${created.data.data.id}`, { token: buyerToken });
  const invoice = invoices.data.data.find((i) => i.order_id === created.data.data.id);

  await req(ctx.baseUrl, 'POST', '/payments', {
    token: financeToken, body: { invoice_id: invoice.id, amount: Number(invoice.total_amount), method: 'BANK_TRANSFER', reference: 'TEST-NOTIF' },
  });

  const outbox = await req(ctx.baseUrl, 'GET', '/notifications/outbox?limit=20', { token: adminToken });
  assert.equal(outbox.status, 200);
  const row = outbox.data.data.find((o) => o.template === 'payment_received');
  assert.ok(row, 'a payment_received notification should have been enqueued');
  assert.ok(row.recipient_email, 'the notification must have a real recipient email, not null');
});

test('outbox health endpoint responds, and only FAILED notifications can be retried', async () => {
  const health = await req(ctx.baseUrl, 'GET', '/notifications/outbox/health', { token: adminToken });
  assert.equal(health.status, 200);
  assert.ok(health.data.data);

  const outbox = await req(ctx.baseUrl, 'GET', '/notifications/outbox?limit=50', { token: adminToken });
  const notFailed = outbox.data.data.find((o) => o.status !== 'FAILED');
  assert.ok(notFailed, 'seeded/generated outbox rows should include at least one non-FAILED row for this test');

  const { status, data: body } = await req(ctx.baseUrl, 'POST', `/notifications/outbox/${notFailed.id}/retry`, { token: adminToken });
  assert.equal(status, 409, 'retrying a non-FAILED notification must be rejected');
  assert.equal(body.error.code, 'INVALID_STATE');
});

test('a buyer cannot reach the admin-only notifications outbox', async () => {
  const { status } = await req(ctx.baseUrl, 'GET', '/notifications/outbox', { token: buyerToken });
  assert.equal(status, 403);
});
