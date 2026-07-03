const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let buyerToken;
let buyer2Token;
let adminToken;
let financeToken;
let invoice;

before(async () => {
  ctx = await startServer();
  buyerToken = await login(ctx.baseUrl, 'buyer1');
  buyer2Token = await login(ctx.baseUrl, 'buyer2');
  adminToken = await login(ctx.baseUrl, 'admin');
  financeToken = await login(ctx.baseUrl, 'finance');

  const { data } = await req(ctx.baseUrl, 'GET', '/products/buyer?limit=50', { token: buyerToken });
  const product = data.products.find((p) => p.status === 'ACTIVE' && p.available >= p.moq);
  await req(ctx.baseUrl, 'DELETE', '/cart', { token: buyerToken });
  await req(ctx.baseUrl, 'POST', '/cart/items', { token: buyerToken, body: { product_id: product.id, quantity: product.moq } });
  const created = await req(ctx.baseUrl, 'POST', '/orders', { token: buyerToken, body: {} });
  await req(ctx.baseUrl, 'PATCH', `/orders/${created.data.data.id}/approve`, { token: adminToken, body: {} });
  const invoices = await req(ctx.baseUrl, 'GET', `/invoices?order_id=${created.data.data.id}`, { token: buyerToken });
  invoice = invoices.data.data.find((i) => i.order_id === created.data.data.id);
});

after(async () => { await ctx.close(); });

test('a buyer can see their own invoice, but not another buyer\'s', async () => {
  const own = await req(ctx.baseUrl, 'GET', `/invoices/${invoice.id}`, { token: buyerToken });
  assert.equal(own.status, 200);

  const other = await req(ctx.baseUrl, 'GET', `/invoices/${invoice.id}`, { token: buyer2Token });
  assert.equal(other.status, 403);
});

test('finance officer can list all invoices and filter by order_id', async () => {
  const { status, data } = await req(ctx.baseUrl, 'GET', `/invoices?order_id=${invoice.order_id}`, { token: financeToken });
  assert.equal(status, 200);
  assert.ok(data.data.some((i) => i.id === invoice.id));
});

test('finance aging report and buyer statement both respond with real data', async () => {
  const aging = await req(ctx.baseUrl, 'GET', '/invoices/aging', { token: financeToken });
  assert.equal(aging.status, 200);
  assert.ok(Array.isArray(aging.data.data));

  const meBuyer = await req(ctx.baseUrl, 'GET', '/auth/me', { token: buyerToken });
  const month = new Date().toISOString().slice(0, 7);
  const statement = await req(ctx.baseUrl, 'GET', `/invoices/statements?buyerId=${meBuyer.data.data.id}&month=${month}`, { token: financeToken });
  assert.equal(statement.status, 200);
  assert.ok('closingBalance' in statement.data.data);
});
