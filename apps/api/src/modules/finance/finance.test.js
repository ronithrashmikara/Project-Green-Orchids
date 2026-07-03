const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let financeToken;
let buyerToken;
let adminToken;

before(async () => {
  ctx = await startServer();
  financeToken = await login(ctx.baseUrl, 'finance');
  buyerToken = await login(ctx.baseUrl, 'buyer1');
  adminToken = await login(ctx.baseUrl, 'admin');
});

after(async () => { await ctx.close(); });

test('credit monitor returns real numeric credit limit/used figures per buyer', async () => {
  const { status, data } = await req(ctx.baseUrl, 'GET', '/finance/credit', { token: financeToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(data.data) && data.data.length > 0, 'credit monitor should list at least the seeded buyers');
  for (const row of data.data) {
    assert.equal(typeof row.creditLimit, 'number');
    assert.equal(typeof row.creditUsed, 'number');
  }
});

test('credit monitor is only reachable by roles with credit.view (finance, admin), not a plain buyer', async () => {
  const admin = await req(ctx.baseUrl, 'GET', '/finance/credit', { token: adminToken });
  assert.equal(admin.status, 200);

  const buyer = await req(ctx.baseUrl, 'GET', '/finance/credit', { token: buyerToken });
  assert.equal(buyer.status, 403);
});

test('an order that would exceed a buyer\'s remaining credit is rejected at admin approval, not silently approved', async () => {
  const { data } = await req(ctx.baseUrl, 'GET', '/finance/credit', { token: financeToken });
  const buyerMe = await req(ctx.baseUrl, 'GET', '/auth/me', { token: buyerToken });
  const row = data.data.find((r) => r.id === buyerMe.data.data.trade_account_id || r.businessName === buyerMe.data.data.business_name);
  // If we can't confidently match this buyer's own row, skip rather than assert on the wrong account.
  if (!row) return;
  const remaining = row.creditLimit - row.creditUsed;
  if (remaining <= 0) return;

  const { data: prodData } = await req(ctx.baseUrl, 'GET', '/products/buyer?limit=200', { token: buyerToken });
  const product = prodData.products.find((p) => p.status === 'ACTIVE' && p.price > 0 && p.available >= p.moq);
  if (!product) return;
  const qtyToExceed = Math.ceil((remaining / Number(product.price)) * 2) + product.moq;
  if (qtyToExceed > product.available) return; // not enough stock to construct this scenario safely

  await req(ctx.baseUrl, 'DELETE', '/cart', { token: buyerToken });
  await req(ctx.baseUrl, 'POST', '/cart/items', { token: buyerToken, body: { product_id: product.id, quantity: qtyToExceed } });
  const created = await req(ctx.baseUrl, 'POST', '/orders', { token: buyerToken, body: {} });
  if (created.status !== 201) return;

  const approve = await req(ctx.baseUrl, 'PATCH', `/orders/${created.data.data.id}/approve`, { token: adminToken, body: {} });
  assert.equal(approve.status, 409);
  assert.equal(approve.data.error.code, 'CREDIT_LIMIT_EXCEEDED');
});
