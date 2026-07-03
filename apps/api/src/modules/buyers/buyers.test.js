const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let adminToken;

before(async () => {
  ctx = await startServer();
  adminToken = await login(ctx.baseUrl, 'admin');
});

after(async () => { await ctx.close(); });

test('admin can list buyers and drill into one buyer\'s orders/invoices', async () => {
  const list = await req(ctx.baseUrl, 'GET', '/buyers?limit=10', { token: adminToken });
  assert.equal(list.status, 200);
  assert.ok(list.data.data.length > 0);

  const buyer = list.data.data[0];
  const orders = await req(ctx.baseUrl, 'GET', `/buyers/${buyer.id}/orders`, { token: adminToken });
  assert.equal(orders.status, 200);

  const invoices = await req(ctx.baseUrl, 'GET', `/buyers/${buyer.id}/invoices`, { token: adminToken });
  assert.equal(invoices.status, 200);
});

test('a plain buyer cannot reach the admin buyer-management routes', async () => {
  const buyerToken = await login(ctx.baseUrl, 'buyer1');
  const { status } = await req(ctx.baseUrl, 'GET', '/buyers', { token: buyerToken });
  assert.equal(status, 403);
});
